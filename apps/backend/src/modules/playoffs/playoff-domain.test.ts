import { describe, expect, it } from "vitest"

import {
  createMatchSlots,
  playoffRoundName,
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
})
