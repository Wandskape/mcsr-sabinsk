import type { Standing } from "@mcsr-sabinsk/shared"
import { describe, expect, it } from "vitest"

import { buildStandingsPresentation } from "./standings-presentation.js"

function standing(rank: number, eliminated: boolean): Standing {
  return {
    rank,
    registrationId: `registration-${rank}`,
    participantUuid: `uuid-${rank}`,
    nickname: `Player${rank}`,
    points: 20 - rank,
    averageTimeMs: 100_000 + rank,
    playedMatches: 3,
    dnfCount: 0,
    missedCount: 0,
    eliminated,
  }
}

describe("standings elimination presentation", () => {
  it("inserts one divider before the first eliminated player", () => {
    expect(
      buildStandingsPresentation([
        standing(1, false),
        standing(2, false),
        standing(3, true),
        standing(4, true),
      ]).map((row) => row.type)
    ).toEqual([
      "standing",
      "standing",
      "eliminated-divider",
      "standing",
      "standing",
    ])
  })

  it("does not add a divider before elimination begins", () => {
    expect(buildStandingsPresentation([standing(1, false)])).toHaveLength(1)
  })
})
