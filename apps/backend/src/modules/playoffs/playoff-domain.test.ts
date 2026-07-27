import { describe, expect, it } from "vitest"

import {
  createMatchSlots,
  matchLoser,
  nextMainMatchTarget,
  playoffRoundName,
  rankPlayoffEntrants,
  validateMatchState,
} from "./playoff-domain.js"

describe("playoff domain", () => {
  it("creates every match for an eight-player bracket", () => {
    const slots = createMatchSlots(8, true)
    expect(slots.filter((slot) => slot.kind === "MAIN")).toHaveLength(7)
    expect(slots.filter((slot) => slot.kind === "THIRD_PLACE")).toHaveLength(1)
  })

  it("names rounds based on bracket size", () => {
    expect(playoffRoundName(16, 1)).toBe("1/8 финала")
    expect(playoffRoundName(16, 3)).toBe("Полуфиналы")
    expect(playoffRoundName(16, 4)).toBe("Финал")
  })

  it("requires a non-drawn completed result", () => {
    expect(
      validateMatchState({
        participant1RegistrationId: "one",
        participant2RegistrationId: "two",
        score1: 2,
        score2: 2,
        winnerRegistrationId: "one",
        status: "COMPLETED",
      })
    ).toContain("равный счёт")
  })

  it("accepts a manually selected winner", () => {
    expect(
      validateMatchState({
        participant1RegistrationId: "one",
        participant2RegistrationId: "two",
        score1: 3,
        score2: 1,
        winnerRegistrationId: "one",
        status: "COMPLETED",
      })
    ).toBeNull()
  })

  it("selects qualification leaders by points and then average time", () => {
    const ranked = rankPlayoffEntrants([
      {
        id: "slow",
        qualificationPoints: 10,
        averageTimeMs: 600_000,
        nicknameSnapshot: "Slow",
        tieBreaker: "2",
      },
      {
        id: "leader",
        qualificationPoints: 12,
        averageTimeMs: 700_000,
        nicknameSnapshot: "Leader",
        tieBreaker: "1",
      },
      {
        id: "fast",
        qualificationPoints: 10,
        averageTimeMs: 500_000,
        nicknameSnapshot: "Fast",
        tieBreaker: "3",
      },
    ])
    expect(ranked.map((registration) => registration.id)).toEqual([
      "leader",
      "fast",
      "slow",
    ])
  })

  it("routes winners to the correct next-round slot", () => {
    expect(nextMainMatchTarget(1, 1, 3)).toEqual({
      roundNumber: 2,
      position: 1,
      slot: 1,
    })
    expect(nextMainMatchTarget(1, 2, 3)).toEqual({
      roundNumber: 2,
      position: 1,
      slot: 2,
    })
    expect(nextMainMatchTarget(3, 1, 3)).toBeNull()
  })

  it("selects the loser for the third-place match", () => {
    expect(
      matchLoser({
        participant1RegistrationId: "winner",
        participant2RegistrationId: "loser",
        score1: 3,
        score2: 1,
        winnerRegistrationId: "winner",
        status: "COMPLETED",
      })
    ).toBe("loser")
  })
})
