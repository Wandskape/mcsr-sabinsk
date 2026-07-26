import "reflect-metadata"

import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js"
import { ConfigService } from "@nestjs/config"
import { describe, expect, it } from "vitest"

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
})
