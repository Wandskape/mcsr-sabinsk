import "reflect-metadata"

import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js"
import { ConfigService } from "@nestjs/config"
import { describe, expect, it } from "vitest"

import { AdminController } from "../admin/admin.controller.js"
import { AdminService } from "../admin/admin.service.js"
import { AdminTournamentsController } from "../admin-tournaments/admin-tournaments.controller.js"
import { AdminTournamentsService } from "../admin-tournaments/admin-tournaments.service.js"
import { AuditService } from "../audit/audit.service.js"
import { AuthController } from "../auth/auth.controller.js"
import { AuthService } from "../auth/auth.service.js"
import { AdminSessionGuard } from "../auth/guards/admin-session.guard.js"
import { CsrfGuard } from "../auth/guards/csrf.guard.js"
import { HealthController } from "../health/health.controller.js"
import { MediaController } from "../media/media.controller.js"
import { MediaService } from "../media/media.service.js"
import { ParticipantsController } from "../participants/participants.controller.js"
import { ParticipantsService } from "../participants/participants.service.js"
import { QualificationController } from "../qualification/qualification.controller.js"
import { QualificationImportController } from "../qualification/qualification-import.controller.js"
import { QualificationImportService } from "../qualification/qualification-import.service.js"
import { QualificationService } from "../qualification/qualification.service.js"
import { RankedService } from "../ranked/ranked.service.js"
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
    [QualificationImportController, QualificationImportService],
    [QualificationImportService, PrismaService],
    [AuditService, PrismaService],
    [AuthService, PrismaService],
    [AuthController, AuthService],
    [AdminSessionGuard, AuthService],
    [CsrfGuard, AuthService],
    [AdminService, PrismaService],
    [AdminController, AdminService],
    [AdminTournamentsController, AdminTournamentsService],
    [AdminTournamentsService, PrismaService],
    [MediaController, MediaService],
    [MediaService, ConfigService],
    [RankedService, ConfigService],
    [ParticipantsController, ParticipantsService],
    [ParticipantsService, PrismaService],
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

  it("keeps every explicit AdminTournamentsService dependency token", () => {
    const explicitDependencies = Reflect.getMetadata(
      SELF_DECLARED_DEPS_METADATA,
      AdminTournamentsService
    ) as Array<{ index: number; param: unknown }>

    expect(explicitDependencies).toEqual(
      expect.arrayContaining([
        { index: 0, param: PrismaService },
        { index: 1, param: AuditService },
        { index: 2, param: MediaService },
      ])
    )
  })

  it("keeps every explicit ParticipantsService dependency token", () => {
    const explicitDependencies = Reflect.getMetadata(
      SELF_DECLARED_DEPS_METADATA,
      ParticipantsService
    ) as Array<{ index: number; param: unknown }>

    expect(explicitDependencies).toEqual(
      expect.arrayContaining([
        { index: 0, param: PrismaService },
        { index: 1, param: RankedService },
        { index: 2, param: AuditService },
      ])
    )
  })

  it("keeps every explicit QualificationImportService dependency token", () => {
    const explicitDependencies = Reflect.getMetadata(
      SELF_DECLARED_DEPS_METADATA,
      QualificationImportService
    ) as Array<{ index: number; param: unknown }>

    expect(explicitDependencies).toEqual(
      expect.arrayContaining([
        { index: 0, param: PrismaService },
        { index: 1, param: RankedService },
        { index: 2, param: ConfigService },
        { index: 3, param: AuditService },
      ])
    )
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
