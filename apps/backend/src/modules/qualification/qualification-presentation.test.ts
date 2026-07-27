import type { QualificationMatchResult } from "@mcsr-sabinsk/shared"
import { describe, expect, it } from "vitest"

import { sortQualificationMatchResults } from "./qualification-presentation.js"

function result(
  nickname: string,
  status: QualificationMatchResult["status"],
  options: {
    placement?: number | null
    timeMs?: number | null
    phase?: string | null
    progressMs?: number
  } = {}
): QualificationMatchResult {
  return {
    registrationId: `registration-${nickname}`,
    participantUuid: nickname.toLowerCase().padEnd(32, "0"),
    nickname,
    avatarUrl: "",
    status,
    placement: options.placement ?? null,
    timeMs: options.timeMs ?? null,
    effectiveTimeMs: 300_000,
    lastPhase: options.phase ?? null,
    timeline:
      options.progressMs === undefined
        ? []
        : [
            {
              phase: options.phase ?? "OVERWORLD",
              startMs: 0,
              endMs: options.progressMs,
            },
          ],
  }
}

describe("public qualification result ordering", () => {
  it("places finishers first, then DNF by phase/progress, then missed", () => {
    const sorted = sortQualificationMatchResults([
      result("Missed", "MISSED"),
      result("EarlyDnf", "DNF", {
        phase: "NETHER",
        progressMs: 90_000,
      }),
      result("Second", "COMPLETED", {
        placement: 2,
        timeMs: 120_000,
      }),
      result("LateDnf", "DNF", {
        phase: "THE_END",
        progressMs: 200_000,
      }),
      result("First", "COMPLETED", {
        placement: 1,
        timeMs: 100_000,
      }),
    ])

    expect(sorted.map((entry) => entry.nickname)).toEqual([
      "First",
      "Second",
      "LateDnf",
      "EarlyDnf",
      "Missed",
    ])
  })

  it("uses progress time and nickname as deterministic DNF tie-breakers", () => {
    const sorted = sortQualificationMatchResults([
      result("Zulu", "DNF", {
        phase: "STRONGHOLD",
        progressMs: 100_000,
      }),
      result("Bravo", "DNF", {
        phase: "STRONGHOLD",
        progressMs: 120_000,
      }),
      result("Alpha", "DNF", {
        phase: "STRONGHOLD",
        progressMs: 100_000,
      }),
    ])

    expect(sorted.map((entry) => entry.nickname)).toEqual([
      "Bravo",
      "Alpha",
      "Zulu",
    ])
  })
})
