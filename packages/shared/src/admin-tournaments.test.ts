import { describe, expect, it } from "vitest"

import {
  CreateTournamentRequestSchema,
  SetTournamentCoverRequestSchema,
  UpdateTournamentRequestSchema,
} from "./admin-tournaments.js"

const validTournament = {
  name: "Кубок Сабинска #1",
  slug: "kubok-sabinska-1",
  description: "Описание",
  startsAt: "2026-08-10T09:00:00.000Z",
  endsAt: "2026-08-17T18:00:00.000Z",
  divisionTimeLimitsMs: {
    BEGINNER: 3_600_000,
    EXPERIENCED: 2_700_000,
    PRO: 1_800_000,
  },
}

describe("admin tournament contracts", () => {
  it("accepts a complete tournament", () => {
    expect(CreateTournamentRequestSchema.parse(validTournament)).toEqual(
      validTournament
    )
  })

  it("rejects an invalid date range for create and update", () => {
    const invalid = {
      ...validTournament,
      endsAt: validTournament.startsAt,
    }
    expect(CreateTournamentRequestSchema.safeParse(invalid).success).toBe(false)
    expect(
      UpdateTournamentRequestSchema.safeParse({
        ...invalid,
        expectedVersion: 1,
      }).success
    ).toBe(false)
  })

  it("rejects an unsafe slug and an out-of-range time limit", () => {
    expect(
      CreateTournamentRequestSchema.safeParse({
        ...validTournament,
        slug: "../Кубок",
        divisionTimeLimitsMs: {
          ...validTournament.divisionTimeLimitsMs,
          PRO: 1_000,
        },
      }).success
    ).toBe(false)
  })

  it("does not accept a client-controlled public cover URL", () => {
    const parsed = SetTournamentCoverRequestSchema.parse({
      objectKey: "covers/example.webp",
      publicUrl: "https://attacker.invalid/image.webp",
      expectedVersion: 1,
    })
    expect(parsed).toEqual({
      objectKey: "covers/example.webp",
      expectedVersion: 1,
    })
  })
})
