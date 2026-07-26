import { describe, expect, it } from "vitest"

import { selectDefaultTournament } from "./tournament-selection.js"

const date = (value: string) => new Date(value)

describe("selectDefaultTournament", () => {
  it("prefers an active tournament", () => {
    const result = selectDefaultTournament(
      [
        {
          id: "upcoming",
          status: "UPCOMING",
          startsAt: date("2026-09-01T00:00:00Z"),
          endsAt: date("2026-09-10T00:00:00Z"),
        },
        {
          id: "active",
          status: "QUALIFICATION",
          startsAt: date("2026-08-01T00:00:00Z"),
          endsAt: date("2026-08-10T00:00:00Z"),
        },
      ],
      date("2026-07-01T00:00:00Z")
    )

    expect(result?.id).toBe("active")
  })

  it("falls back to the nearest upcoming tournament", () => {
    const result = selectDefaultTournament(
      [
        {
          id: "later",
          status: "UPCOMING",
          startsAt: date("2026-09-01T00:00:00Z"),
          endsAt: date("2026-09-10T00:00:00Z"),
        },
        {
          id: "nearer",
          status: "UPCOMING",
          startsAt: date("2026-08-01T00:00:00Z"),
          endsAt: date("2026-08-10T00:00:00Z"),
        },
      ],
      date("2026-07-01T00:00:00Z")
    )

    expect(result?.id).toBe("nearer")
  })
})
