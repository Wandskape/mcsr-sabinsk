import { describe, expect, it } from "vitest"

import {
  calculateQualificationStandings,
  eligibleRegistrationIdsBeforeMatch,
  type QualificationEliminationMatch,
} from "./qualification-elimination.js"

const registrations = Array.from({ length: 12 }, (_, index) => ({
  id: `r-${index + 1}`,
  nickname: `Player${String(index + 1).padStart(2, "0")}`,
}))

function match(
  matchNumber: number,
  pointsByRegistration: Record<string, number>
): QualificationEliminationMatch {
  return {
    matchNumber,
    results: registrations.map((registration, index) => ({
      registrationId: registration.id,
      points: pointsByRegistration[registration.id] ?? 0,
      effectiveTimeMs: 100_000 + index * 1_000,
      status: "COMPLETED",
    })),
  }
}

describe("qualification elimination", () => {
  it("eliminates zero-point beginners after match 3", () => {
    const standings = calculateQualificationStandings({
      divisionType: "BEGINNER",
      timeLimitMs: 300_000,
      registrations,
      matches: [
        match(1, { "r-1": 24 }),
        match(2, { "r-2": 24 }),
        match(3, { "r-3": 24 }),
      ],
    })

    expect(
      standings
        .filter((standing) => standing.eliminated)
        .map((row) => row.registrationId)
    ).toEqual([
      "r-4",
      "r-5",
      "r-6",
      "r-7",
      "r-8",
      "r-9",
      "r-10",
      "r-11",
      "r-12",
    ])
    expect(standings.find((row) => row.registrationId === "r-4")).toMatchObject(
      { eliminatedAfterMatch: 3 }
    )
  })

  it("keeps top 8 and then top 4 beginners using average time as tie-break", () => {
    const firstThree = [1, 2, 3].map((number) =>
      match(
        number,
        Object.fromEntries(
          registrations.map((registration) => [registration.id, 2])
        )
      )
    )
    const fourth = match(
      4,
      Object.fromEntries(
        registrations.map((registration) => [registration.id, 2])
      )
    )
    const fifth = match(
      5,
      Object.fromEntries(
        registrations.map((registration) => [registration.id, 2])
      )
    )
    const standingsAfterFour = calculateQualificationStandings({
      divisionType: "BEGINNER",
      timeLimitMs: 300_000,
      registrations,
      matches: [...firstThree, fourth],
    })
    const standingsAfterFive = calculateQualificationStandings({
      divisionType: "BEGINNER",
      timeLimitMs: 300_000,
      registrations,
      matches: [...firstThree, fourth, fifth],
    })

    expect(standingsAfterFour.filter((row) => !row.eliminated)).toHaveLength(8)
    expect(
      standingsAfterFour
        .filter((row) => !row.eliminated)
        .map((row) => row.registrationId)
    ).toEqual(registrations.slice(0, 8).map((registration) => registration.id))
    expect(standingsAfterFive.filter((row) => !row.eliminated)).toHaveLength(4)
  })

  it.each([
    ["EXPERIENCED", 5, 8],
    ["EXPERIENCED", 7, 6],
    ["EXPERIENCED", 8, 4],
    ["PRO", 5, 8],
    ["PRO", 7, 6],
    ["PRO", 8, 4],
  ] as const)(
    "applies %s cutoff after match %i",
    (divisionType, lastMatch, activeCount) => {
      const matches = Array.from({ length: lastMatch }, (_, index) =>
        match(
          index + 1,
          Object.fromEntries(
            registrations.map((registration) => [registration.id, 2])
          )
        )
      )
      const standings = calculateQualificationStandings({
        divisionType,
        timeLimitMs: 300_000,
        registrations,
        matches,
      })

      expect(standings.filter((row) => !row.eliminated)).toHaveLength(
        activeCount
      )
    }
  )

  it("does not count later results of an eliminated player", () => {
    const standings = calculateQualificationStandings({
      divisionType: "BEGINNER",
      timeLimitMs: 300_000,
      registrations: registrations.slice(0, 3),
      matches: [
        match(1, { "r-1": 24 }),
        match(2, { "r-1": 24 }),
        match(3, { "r-1": 24 }),
        match(4, { "r-2": 24 }),
      ],
    })

    expect(standings.find((row) => row.registrationId === "r-2")).toMatchObject(
      {
        eliminated: true,
        eliminatedAfterMatch: 3,
        points: 0,
        playedMatches: 3,
      }
    )
  })

  it("returns only non-eliminated registrations for the next match", () => {
    const ids = eligibleRegistrationIdsBeforeMatch({
      divisionType: "BEGINNER",
      timeLimitMs: 300_000,
      registrations: registrations.slice(0, 4),
      matches: [
        match(1, { "r-1": 24 }),
        match(2, { "r-1": 24 }),
        match(3, { "r-1": 24 }),
      ],
      matchNumber: 4,
    })

    expect([...ids]).toEqual(["r-1"])
  })
})
