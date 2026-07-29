import type { RankedMatchPayload } from "@mcsr-sabinsk/shared"
import { describe, expect, it } from "vitest"

import {
  calculatePoints,
  calculateQualificationMatch,
} from "./qualification-import.domain.js"

const UUIDS = {
  alpha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  bravo: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  charlie: "cccccccccccccccccccccccccccccccc",
  delta: "dddddddddddddddddddddddddddddddd",
  echo: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  missed: "ffffffffffffffffffffffffffffffff",
  outsider: "11111111111111111111111111111111",
}

const registrations = [
  { id: "r-alpha", participantUuid: UUIDS.alpha, nickname: "Alpha" },
  { id: "r-bravo", participantUuid: UUIDS.bravo, nickname: "Bravo" },
  { id: "r-charlie", participantUuid: UUIDS.charlie, nickname: "Charlie" },
  { id: "r-delta", participantUuid: UUIDS.delta, nickname: "Delta" },
  { id: "r-echo", participantUuid: UUIDS.echo, nickname: "Echo" },
  { id: "r-missed", participantUuid: UUIDS.missed, nickname: "Missed" },
]

function matchPayload(): RankedMatchPayload {
  return {
    id: 123_456,
    date: 1_700_000_000,
    seedType: null,
    bastionType: null,
    players: [
      { uuid: UUIDS.alpha, nickname: "Alpha" },
      { uuid: UUIDS.bravo, nickname: "Bravo" },
      { uuid: UUIDS.charlie, nickname: "Charlie" },
      { uuid: UUIDS.delta, nickname: "Delta" },
      { uuid: UUIDS.echo, nickname: "Echo" },
      { uuid: UUIDS.outsider, nickname: "Host" },
    ],
    spectators: [],
    completions: [
      { uuid: UUIDS.alpha, time: 100_000 },
      { uuid: UUIDS.bravo, time: 110_000 },
      { uuid: UUIDS.charlie, time: 120_000 },
      { uuid: UUIDS.delta, time: 250_000 },
    ],
    timelines: [
      {
        uuid: UUIDS.alpha,
        time: 10_000,
        type: "story.enter_the_nether",
      },
      {
        uuid: UUIDS.alpha,
        time: 90_000,
        type: "projectelo.timeline.dragon_death",
      },
    ],
  }
}

describe("qualification match calculation", () => {
  it("calculates COMPLETED, DNF and MISSED using only registered players", () => {
    const result = calculateQualificationMatch(
      matchPayload(),
      registrations,
      200_000,
      12
    )

    expect(result.participantCount).toBe(5)
    expect(result.winnerRegistrationId).toBe("r-alpha")
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          registrationId: "r-alpha",
          status: "COMPLETED",
          placement: 1,
          points: 24,
          effectiveTimeMs: 100_000,
        }),
        expect.objectContaining({
          registrationId: "r-bravo",
          status: "COMPLETED",
          placement: 2,
          points: 22,
        }),
        expect.objectContaining({
          registrationId: "r-charlie",
          status: "COMPLETED",
          placement: 3,
          points: 20,
        }),
        expect.objectContaining({
          registrationId: "r-delta",
          status: "DNF",
          rawTimeMs: 250_000,
          effectiveTimeMs: 200_000,
          points: 0,
        }),
        expect.objectContaining({
          registrationId: "r-echo",
          status: "DNF",
          rawTimeMs: null,
          effectiveTimeMs: 200_000,
        }),
        expect.objectContaining({
          registrationId: "r-missed",
          status: "MISSED",
          effectiveTimeMs: 200_000,
        }),
      ])
    )
    expect(result.ignoredPlayers).toEqual([
      { participantUuid: UUIDS.outsider, nickname: "Host" },
    ])
    expect(result.warnings).toHaveLength(3)
  })

  it("normalizes major timeline phases and the finished segment", () => {
    const result = calculateQualificationMatch(
      matchPayload(),
      registrations,
      200_000,
      12
    )
    const alpha = result.results.find(
      (entry) => entry.registrationId === "r-alpha"
    )

    expect(alpha?.lastPhase).toBe("FINISHED")
    expect(alpha?.timeline).toEqual([
      { phase: "OVERWORLD", startMs: 0, endMs: 10_000 },
      { phase: "NETHER", startMs: 10_000, endMs: 90_000 },
      { phase: "FINISHED", startMs: 90_000, endMs: 100_000 },
    ])
  })

  it("breaks equal completion times by nickname and then UUID", () => {
    const payload = matchPayload()
    payload.players = [
      { uuid: UUIDS.alpha, nickname: "Alpha" },
      { uuid: UUIDS.bravo, nickname: "Bravo" },
    ]
    payload.completions = [
      { uuid: UUIDS.alpha, time: 100_000 },
      { uuid: UUIDS.bravo, time: 100_000 },
    ]

    const result = calculateQualificationMatch(
      payload,
      [
        { id: "r-bravo", participantUuid: UUIDS.bravo, nickname: "Zulu" },
        { id: "r-alpha", participantUuid: UUIDS.alpha, nickname: "Alpha" },
      ],
      200_000,
      12
    )

    expect(
      result.results.find((entry) => entry.registrationId === "r-alpha")
        ?.placement
    ).toBe(1)
    expect(
      result.results.find((entry) => entry.registrationId === "r-bravo")
        ?.placement
    ).toBe(2)
  })
})

describe("qualification points", () => {
  it.each([4, 6, 8, 10, 12] as const)(
    "awards 24 minus two per place for a %i-completion match",
    (completionLimit) => {
      const points = Array.from({ length: completionLimit + 1 }, (_, index) =>
        calculatePoints(index + 1, completionLimit)
      )

      expect(points.slice(0, completionLimit)).toEqual(
        Array.from({ length: completionLimit }, (_, index) => 24 - index * 2)
      )
      expect(points.at(-1)).toBe(0)
    }
  )

  it("uses the configured limit even when fewer players finish", () => {
    expect([1, 2, 3, 4].map((place) => calculatePoints(place, 12))).toEqual([
      24, 22, 20, 18,
    ])
  })
})
