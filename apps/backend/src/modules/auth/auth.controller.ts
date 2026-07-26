import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common"
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger"
import { Throttle, ThrottlerGuard } from "@nestjs/throttler"
import type { Request, Response } from "express"

import { AuthService } from "./auth.service.js"
import type {
  AuthenticatedRequest,
  AuthenticationRequestContext,
} from "./auth.types.js"
import { LoginRequestDto } from "./dto/login-request.dto.js"
import { AdminSessionGuard } from "./guards/admin-session.guard.js"
import { CsrfGuard } from "./guards/csrf.guard.js"

function requestContext(
  request: Request,
  response: Response
): AuthenticationRequestContext {
  return {
    ipAddress: request.ip || request.socket.remoteAddress || "unknown",
    userAgent: request.header("user-agent")?.slice(0, 512) ?? null,
    requestId: String(response.locals.requestId ?? "unknown"),
  }
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 25, ttl: 15 * 60 * 1_000 } })
  @ApiBody({ type: LoginRequestDto })
  @ApiOperation({ summary: "Вход администратора" })
  async login(
    @Body() input: LoginRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const hasBrowserOrigin =
      request.header("origin") !== undefined ||
      request.header("referer") !== undefined
    if (hasBrowserOrigin && !this.auth.isRequestOriginAllowed(request)) {
      throw new ForbiddenException("Источник запроса не разрешён.")
    }

    const result = await this.auth.login(
      input,
      requestContext(request, response)
    )
    response.cookie(
      this.auth.getSessionCookieName(),
      result.sessionToken,
      this.auth.getSessionCookieOptions(result.expiresAt)
    )

    return {
      data: {
        admin: result.admin,
        expiresAt: result.expiresAt.toISOString(),
        csrfToken: result.csrfToken,
      },
    }
  }

  @Get("me")
  @UseGuards(AdminSessionGuard)
  @ApiOperation({ summary: "Текущий администратор" })
  me(@Req() request: AuthenticatedRequest) {
    return {
      data: {
        admin: request.adminSession.admin,
        expiresAt: request.adminSession.expiresAt.toISOString(),
        csrfToken: request.adminSession.csrfToken,
      },
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AdminSessionGuard, CsrfGuard)
  @ApiOperation({ summary: "Выход администратора" })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    await this.auth.logout(
      request.adminSession,
      requestContext(request, response)
    )
    response.clearCookie(
      this.auth.getSessionCookieName(),
      this.auth.getSessionCookieOptions()
    )
  }
}
