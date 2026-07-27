import { BadRequestException } from "@nestjs/common"
import { describe, expect, it } from "vitest"

import { TournamentStatus } from "../../generated/prisma/enums.js"
import {
  assertStatusTransition,
  assertValidDateRange,
  participatingDivisionIds,
} from "./tournament-policy.js"

describe("tournament policy", () => {
  it.each([
    [TournamentStatus.DRAFT, TournamentStatus.UPCOMING],
    [TournamentStatus.UPCOMING, TournamentStatus.QUALIFICATION],
    [TournamentStatus.QUALIFICATION, TournamentStatus.PLAYOFF],
    [TournamentStatus.QUALIFICATION, TournamentStatus.COMPLETED],
    [TournamentStatus.PLAYOFF, TournamentStatus.COMPLETED],
  ])("allows %s -> %s", (current, next) => {
    expect(() => assertStatusTransition(current, next)).not.toThrow()
  })

  it.each([
    [TournamentStatus.DRAFT, TournamentStatus.QUALIFICATION],
    [TournamentStatus.UPCOMING, TournamentStatus.COMPLETED],
    [TournamentStatus.PLAYOFF, TournamentStatus.QUALIFICATION],
    [TournamentStatus.COMPLETED, TournamentStatus.DRAFT],
  ])("rejects %s -> %s", (current, next) => {
    expect(() => assertStatusTransition(current, next)).toThrow(
      BadRequestException
    )
  })

  it("requires the end to be after the start", () => {
    expect(() =>
      assertValidDateRange(
        new Date("2026-08-10T00:00:00Z"),
        new Date("2026-08-10T00:00:00Z")
      )
    ).toThrow(BadRequestException)
  })

  it("starts with only non-empty divisions", () => {
    expect(
      participatingDivisionIds([
        { id: "beginner", registrationCount: 4 },
        { id: "experienced", registrationCount: 0 },
        { id: "pro", registrationCount: 2 },
      ])
    ).toEqual(["beginner", "pro"])
  })

  it("requires at least one non-empty division", () => {
    expect(() =>
      participatingDivisionIds([
        { id: "beginner", registrationCount: 0 },
        { id: "experienced", registrationCount: 0 },
        { id: "pro", registrationCount: 0 },
      ])
    ).toThrow(BadRequestException)
  })
})
