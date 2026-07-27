import { BadRequestException, ConflictException } from "@nestjs/common"
import type { RankedUserProfile } from "@mcsr-sabinsk/shared"
import { describe, expect, it, vi } from "vitest"

import { TournamentStatus } from "../../generated/prisma/enums.js"
import { ParticipantsService } from "./participants.service.js"

const profile: RankedUserProfile = {
  uuid: "abcdef0123456789abcdef0123456789",
  nickname: "PlayerOne",
  roleType: 1,
  eloRate: 1_200,
  eloRank: 50,
  country: "ru",
  avatarUrl: "https://mc-heads.net/avatar/abcdef0123456789abcdef0123456789/40",
}

function dependencies(options?: {
  locked?: boolean
  status?: TournamentStatus
  isParticipating?: boolean
}) {
  const division = {
    id: "division",
    tournamentId: "tournament",
    version: 3,
    isParticipating: options?.isParticipating ?? false,
    tournament: { status: options?.status ?? TournamentStatus.UPCOMING },
    qualificationMatches: options?.locked ? [{ id: "match" }] : [],
  }
  const prisma = {
    division: {
      findUnique: vi.fn().mockResolvedValue(division),
    },
    tournamentRegistration: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    participant: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }
  const ranked = {
    resolveUsers: vi.fn(),
  }
  const audit = { record: vi.fn() }
  const service = new ParticipantsService(
    prisma as never,
    ranked as never,
    audit as never
  )
  return { service, prisma, ranked }
}

describe("ParticipantsService preview", () => {
  it("marks a valid profile as ready and repeated input as duplicate", async () => {
    const { service, ranked } = dependencies()
    ranked.resolveUsers.mockResolvedValue(new Map([["PlayerOne", profile]]))

    const result = await service.preview("division", ["PlayerOne", "playerone"])

    expect(result.data.readyCount).toBe(1)
    expect(result.data.items.map((item) => item.status)).toEqual([
      "READY",
      "DUPLICATE_INPUT",
    ])
  })

  it("reports an existing registration in another division", async () => {
    const { service, prisma, ranked } = dependencies()
    ranked.resolveUsers.mockResolvedValue(new Map([["PlayerOne", profile]]))
    prisma.tournamentRegistration.findMany.mockResolvedValue([
      {
        participant: { rankedUuid: profile.uuid },
        division: { id: "other", displayName: "Про" },
      },
    ])

    const result = await service.preview("division", ["PlayerOne"])

    expect(result.data.items[0]).toMatchObject({
      status: "CONFLICT",
      registeredDivision: "Про",
    })
  })

  it("does not call Ranked when a write targets a locked roster", async () => {
    const { service, ranked } = dependencies({ locked: true })

    await expect(
      service.addBulk("division", ["PlayerOne"], 3, {
        adminUserId: "admin",
        requestId: "request",
      })
    ).rejects.toBeInstanceOf(ConflictException)
    expect(ranked.resolveUsers).not.toHaveBeenCalled()
  })

  it("does not allow adding players to a division excluded at start", async () => {
    const { service, ranked } = dependencies({
      status: TournamentStatus.QUALIFICATION,
      isParticipating: false,
    })

    await expect(
      service.addBulk("division", ["PlayerOne"], 3, {
        adminUserId: "admin",
        requestId: "request",
      })
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(ranked.resolveUsers).not.toHaveBeenCalled()
  })
})
