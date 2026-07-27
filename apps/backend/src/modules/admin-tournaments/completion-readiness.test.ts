import { describe, expect, it, vi } from "vitest"

import {
  PlayoffMatchKind,
  PlayoffMatchStatus,
  TournamentStatus,
} from "../../generated/prisma/enums.js"
import { AdminTournamentsService } from "./admin-tournaments.service.js"

function tournament(status: TournamentStatus) {
  return {
    id: "tournament",
    status,
    divisions: [
      {
        id: "division",
        displayName: "Новички",
        isParticipating: true,
        qualificationMatches: [{ id: "qualification-match" }],
        _count: { registrations: 4, qualificationMatches: 1 },
      },
    ],
  }
}

function dependencies(options?: {
  status?: TournamentStatus
  pendingImports?: number
  brackets?: Array<Record<string, unknown>>
}) {
  const prisma = {
    tournament: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          tournament(options?.status ?? TournamentStatus.PLAYOFF)
        ),
    },
    qualificationMatchImport: {
      count: vi.fn().mockResolvedValue(options?.pendingImports ?? 0),
    },
    playoffBracket: {
      findMany: vi.fn().mockResolvedValue(options?.brackets ?? []),
    },
  }
  return new AdminTournamentsService(
    prisma as never,
    { record: vi.fn() } as never,
    {} as never
  )
}

describe("completion readiness", () => {
  it("allows a playoff whose published matches are completed", async () => {
    const service = dependencies({
      brackets: [
        {
          isPublished: true,
          showThirdPlace: false,
          division: { displayName: "Новички" },
          matches: [
            {
              kind: PlayoffMatchKind.MAIN,
              status: PlayoffMatchStatus.COMPLETED,
            },
            {
              kind: PlayoffMatchKind.THIRD_PLACE,
              status: PlayoffMatchStatus.READY,
            },
          ],
        },
      ],
    })

    const result = await service.completionReadiness("tournament")

    expect(result.data.canComplete).toBe(true)
    expect(
      result.data.checks.find((check) => check.code === "PUBLISHED_PLAYOFFS")
    ).toMatchObject({ passed: true, blocking: true })
  })

  it("blocks pending imports and incomplete published matches", async () => {
    const service = dependencies({
      pendingImports: 1,
      brackets: [
        {
          isPublished: true,
          showThirdPlace: false,
          division: { displayName: "Новички" },
          matches: [
            {
              kind: PlayoffMatchKind.MAIN,
              status: PlayoffMatchStatus.READY,
            },
          ],
        },
      ],
    })

    const result = await service.completionReadiness("tournament")

    expect(result.data.canComplete).toBe(false)
    expect(
      result.data.checks.filter((check) => check.blocking && !check.passed)
    ).toEqual([
      expect.objectContaining({ code: "PENDING_IMPORTS" }),
      expect.objectContaining({ code: "PUBLISHED_PLAYOFFS" }),
    ])
  })

  it("requires switching to playoff when a bracket already exists", async () => {
    const service = dependencies({
      status: TournamentStatus.QUALIFICATION,
      brackets: [
        {
          isPublished: false,
          showThirdPlace: false,
          division: { displayName: "Новички" },
          matches: [],
        },
      ],
    })

    const result = await service.completionReadiness("tournament")

    expect(result.data.canComplete).toBe(false)
    expect(
      result.data.checks.find((check) => check.code === "PLAYOFF_ROUTE")
    ).toMatchObject({ passed: false, blocking: true })
  })
})
