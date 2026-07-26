import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import argon2 from "argon2"
import type { CookieOptions, Request } from "express"

import { AuditService } from "../audit/audit.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import {
  CSRF_HEADER_NAME,
  LOGIN_LOCK_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from "./auth.constants.js"
import {
  createCsrfToken,
  generateSessionToken,
  hashIpAddress,
  hashSessionToken,
  tokensMatch,
} from "./auth-crypto.js"
import type {
  AuthenticatedAdminSession,
  AuthenticationRequestContext,
} from "./auth.types.js"
import type { LoginRequestDto } from "./dto/login-request.dto.js"

const GENERIC_LOGIN_ERROR = "Неверный логин или пароль."

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly sessionSecret: string
  private readonly csrfSecret: string
  private readonly cookieName: string
  private readonly frontendOrigin: string
  private readonly isProduction: boolean
  private readonly dummyPasswordHash: Promise<string>

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ConfigService) config: ConfigService
  ) {
    this.sessionSecret = config.getOrThrow<string>("SESSION_SECRET")
    this.csrfSecret = config.getOrThrow<string>("CSRF_SECRET")
    this.cookieName = config.getOrThrow<string>("SESSION_COOKIE_NAME")
    this.frontendOrigin = new URL(
      config.getOrThrow<string>("FRONTEND_ORIGIN")
    ).origin
    this.isProduction = config.getOrThrow<string>("NODE_ENV") === "production"
    this.dummyPasswordHash = argon2.hash(
      "mcsr-sabinsk-dummy-password-not-used",
      { type: argon2.argon2id }
    )
  }

  async login(input: LoginRequestDto, context: AuthenticationRequestContext) {
    const username = input.username.trim().toLocaleLowerCase("ru")
    const admin = await this.prisma.adminUser.findUnique({
      where: { username },
    })

    if (!admin) {
      await argon2.verify(await this.dummyPasswordHash, input.password)
      this.logger.warn(
        `Unknown admin login rejected; ipHash=${this.hashIp(context.ipAddress)}`
      )
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR)
    }

    const now = new Date()
    if (admin.lockedUntil && admin.lockedUntil > now) {
      await this.audit.record({
        adminUserId: admin.id,
        action: "AUTH_LOGIN_BLOCKED",
        entityType: "AdminUser",
        entityId: admin.id,
        requestId: context.requestId,
        ipHash: this.hashIp(context.ipAddress),
        after: {
          lockedUntil: admin.lockedUntil.toISOString(),
        },
      })
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR)
    }

    const passwordIsValid =
      admin.isActive &&
      (await argon2.verify(admin.passwordHash, input.password))
    if (!passwordIsValid) {
      await this.recordFailedLogin(admin.id, admin.failedLoginCount, context)
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR)
    }

    const sessionToken = generateSessionToken()
    const tokenHash = hashSessionToken(sessionToken, this.sessionSecret)
    const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS)
    const ipHash = this.hashIp(context.ipAddress)
    const session = await this.prisma.$transaction(async (transaction) => {
      await transaction.adminUser.update({
        where: { id: admin.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
      })
      const createdSession = await transaction.adminSession.create({
        data: {
          adminUserId: admin.id,
          tokenHash,
          expiresAt,
          lastSeenAt: now,
          ipHash,
          userAgent: context.userAgent?.slice(0, 512) ?? null,
        },
      })
      await this.audit.record(
        {
          adminUserId: admin.id,
          action: "AUTH_LOGIN_SUCCEEDED",
          entityType: "AdminSession",
          entityId: createdSession.id,
          requestId: context.requestId,
          ipHash,
        },
        transaction
      )
      return createdSession
    })

    return {
      sessionToken,
      csrfToken: createCsrfToken(sessionToken, this.csrfSecret),
      expiresAt,
      sessionId: session.id,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    }
  }

  async authenticate(
    request: Request
  ): Promise<AuthenticatedAdminSession | null> {
    const sessionToken = request.cookies?.[this.cookieName] as
      string | undefined
    if (!sessionToken) return null

    const now = new Date()
    const tokenHash = hashSessionToken(sessionToken, this.sessionSecret)
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { adminUser: true },
    })
    if (!session) return null

    const idleExpired =
      now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_TIMEOUT_MS
    const isInvalid =
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      idleExpired ||
      !session.adminUser.isActive
    if (isInvalid) {
      if (session.revokedAt === null) {
        await this.prisma.adminSession.update({
          where: { id: session.id },
          data: { revokedAt: now },
        })
      }
      return null
    }

    if (
      now.getTime() - session.lastSeenAt.getTime() >
      SESSION_TOUCH_INTERVAL_MS
    ) {
      await this.prisma.adminSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      })
    }

    return {
      sessionId: session.id,
      sessionToken,
      csrfToken: createCsrfToken(sessionToken, this.csrfSecret),
      expiresAt: session.expiresAt,
      admin: {
        id: session.adminUser.id,
        username: session.adminUser.username,
      },
    }
  }

  async logout(
    session: AuthenticatedAdminSession,
    context: AuthenticationRequestContext
  ) {
    const now = new Date()
    const ipHash = this.hashIp(context.ipAddress)
    await this.prisma.$transaction(async (transaction) => {
      await transaction.adminSession.update({
        where: { id: session.sessionId },
        data: { revokedAt: now },
      })
      await this.audit.record(
        {
          adminUserId: session.admin.id,
          action: "AUTH_LOGOUT",
          entityType: "AdminSession",
          entityId: session.sessionId,
          requestId: context.requestId,
          ipHash,
        },
        transaction
      )
    })
  }

  isCsrfRequestValid(
    request: Request & { adminSession?: AuthenticatedAdminSession }
  ) {
    const session = request.adminSession
    const receivedToken = request.header(CSRF_HEADER_NAME)
    if (!session || !receivedToken || !this.isRequestOriginAllowed(request)) {
      return false
    }
    return tokensMatch(receivedToken, session.csrfToken)
  }

  isRequestOriginAllowed(request: Request) {
    const origin = request.header("origin")
    const referer = request.header("referer")
    const requestOrigin = `${request.protocol}://${request.get("host")}`
    const allowedOrigins = new Set([this.frontendOrigin, requestOrigin])

    if (origin) return this.isAllowedUrl(origin, allowedOrigins)
    if (referer) return this.isAllowedUrl(referer, allowedOrigins)
    return false
  }

  getSessionCookieOptions(expiresAt?: Date): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: "strict",
      path: "/api/v1",
      ...(expiresAt ? { expires: expiresAt } : {}),
    }
  }

  getSessionCookieName() {
    return this.cookieName
  }

  private async recordFailedLogin(
    adminUserId: string,
    failedLoginCount: number,
    context: AuthenticationRequestContext
  ) {
    const nextFailedLoginCount = failedLoginCount + 1
    const lockedUntil =
      nextFailedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOGIN_LOCK_DURATION_MS)
        : null
    const ipHash = this.hashIp(context.ipAddress)

    await this.prisma.$transaction(async (transaction) => {
      await transaction.adminUser.update({
        where: { id: adminUserId },
        data: {
          failedLoginCount: nextFailedLoginCount,
          lockedUntil,
        },
      })
      await this.audit.record(
        {
          adminUserId,
          action: lockedUntil ? "AUTH_LOGIN_LOCKED" : "AUTH_LOGIN_FAILED",
          entityType: "AdminUser",
          entityId: adminUserId,
          requestId: context.requestId,
          ipHash,
          after: {
            failedLoginCount: nextFailedLoginCount,
            lockedUntil: lockedUntil?.toISOString() ?? null,
          },
        },
        transaction
      )
    })
  }

  private hashIp(ipAddress: string) {
    return hashIpAddress(ipAddress, this.sessionSecret)
  }

  private isAllowedUrl(value: string, allowedOrigins: ReadonlySet<string>) {
    try {
      return allowedOrigins.has(new URL(value).origin)
    } catch {
      return false
    }
  }
}
