import "reflect-metadata"

import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js"
import { ConfigService } from "@nestjs/config"
import { describe, expect, it } from "vitest"

import { AdminController } from "../admin/admin.controller.js"
import { AdminService } from "../admin/admin.service.js"
import { AuditService } from "../audit/audit.service.js"
import { AuthController } from "../auth/auth.controller.js"
import { AuthService } from "../auth/auth.service.js"
import { AdminSessionGuard } from "../auth/guards/admin-session.guard.js"
import { CsrfGuard } from "../auth/guards/csrf.guard.js"
import { HealthController } from "../health/health.controller.js"
import { QualificationController } from "../qualification/qualification.controller.js"
import { QualificationService } from "../qualification/qualification.service.js"
import { TournamentsController } from "../tournaments/tournaments.controller.js"
import { TournamentsService } from "../tournaments/tournaments.service.js"
import { PrismaService } from "./prisma.service.js"

describe("NestJS dependency injection metadata", () => {
  it.each([
    [PrismaService, ConfigService],
    [HealthController, PrismaService],
    [TournamentsService, PrismaService],
    [TournamentsController, TournamentsService],
    [QualificationService, PrismaService],
    [QualificationController, QualificationService],
    [AuditService, PrismaService],
    [AuthService, PrismaService],
    [AuthController, AuthService],
    [AdminSessionGuard, AuthService],
    [CsrfGuard, AuthService],
    [AdminService, PrismaService],
    [AdminController, AdminService],
  ])("keeps a runtime token for %s", (target, dependency) => {
    const explicitDependencies = Reflect.getMetadata(
      SELF_DECLARED_DEPS_METADATA,
      target
    ) as Array<{ index: number; param: unknown }>

    expect(explicitDependencies).toContainEqual({
      index: 0,
      param: dependency,
    })
  })

  it("keeps every explicit AuthService dependency token", () => {
    const explicitDependencies = Reflect.getMetadata(
      SELF_DECLARED_DEPS_METADATA,
      AuthService
    ) as Array<{ index: number; param: unknown }>

    expect(explicitDependencies).toEqual(
      expect.arrayContaining([
        { index: 0, param: PrismaService },
        { index: 1, param: AuditService },
        { index: 2, param: ConfigService },
      ])
    )
  })
})
