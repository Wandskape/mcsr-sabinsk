import type { QualificationMatchResult } from "@mcsr-sabinsk/shared"
import { describe, expect, it } from "vitest"

import {
  formatRaceTime,
  matchResultStatus,
  matchResultTime,
  participantResultLabel,
} from "./qualification-presentation.js"

function result(
  status: QualificationMatchResult["status"]
): QualificationMatchResult {
  return {
    registrationId: "registration",
    participantUuid: "a".repeat(32),
    nickname: "Player",
    avatarUrl: "",
    status,
    placement: status === "COMPLETED" ? 1 : null,
    timeMs: status === "COMPLETED" ? 514_009 : null,
    effectiveTimeMs: 900_000,
    lastPhase: status === "DNF" ? "STRONGHOLD" : null,
    timeline:
      status === "DNF"
        ? [{ phase: "STRONGHOLD", startMs: 400_000, endMs: 456_780 }]
        : [],
  }
}

describe("public qualification presentation", () => {
  it("formats race time without rounding away centiseconds", () => {
    expect(formatRaceTime(514_009)).toBe("8:34.00")
    expect(formatRaceTime(3_754_329)).toBe("1:02:34.32")
    expect(formatRaceTime(null)).toBe("—")
  })

  it("distinguishes placement, DNF and a missed match", () => {
    expect(participantResultLabel("COMPLETED", 1)).toBe("1-е место")
    expect(participantResultLabel("DNF", null)).toBe("DNF")
    expect(participantResultLabel("MISSED", null)).toBe("Не участвовал")
  })

  it("uses stored progress for DNF and raw completion time for a finisher", () => {
    expect(matchResultTime(result("COMPLETED"))).toBe(514_009)
    expect(matchResultTime(result("DNF"))).toBe(456_780)
    expect(matchResultTime(result("MISSED"))).toBeNull()
    expect(matchResultStatus(result("DNF"))).toBe("DNF · крепость края")
  })
})
