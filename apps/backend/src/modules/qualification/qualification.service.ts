import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import type {
  ParticipantMatchResult,
  QualificationCompletionLimit,
  TimelineSegment,
} from "@mcsr-sabinsk/shared"

import { PrismaService } from "../prisma/prisma.service.js"
import {
  calculateQualificationStandings,
  eligibleRegistrationIdsBeforeMatch,
} from "./qualification-elimination.js"
import { sortQualificationMatchResults } from "./qualification-presentation.js"

function parseTimeline(value: unknown): TimelineSegment[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((segment) => {
    if (
      typeof segment !== "object" ||
      segment === null ||
      !("phase" in segment) ||
      !("startMs" in segment) ||
      !("endMs" in segment) ||
      typeof segment.phase !== "string" ||
      typeof segment.startMs !== "number" ||
      typeof segment.endMs !== "number"
    ) {
      return []
    }

    return [
      {
        phase: segment.phase,
        startMs: segment.startMs,
        endMs: segment.endMs,
      },
    ]
  })
}

@Injectable()
export class QualificationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMatch(matchId: string) {
    const match = await this.prisma.qualificationMatch.findUnique({
      where: { id: matchId },
      include: {
        division: {
          select: { id: true, type: true, timeLimitMs: true },
        },
        activeImport: {
          include: {
            results: {
              include: {
                registration: {
                  include: { participant: true },
                },
              },
            },
          },
        },
      },
    })
    if (!match?.activeImport) {
      throw new NotFoundException("Результаты матча не найдены.")
    }

    const eligibleIds = await this.getEligibleRegistrationIds(
      match.division,
      match.matchNumber
    )
    const results = sortQualificationMatchResults(
      match.activeImport.results
        .filter((result) => eligibleIds.has(result.registrationId))
        .map((result) => ({
          registrationId: result.registrationId,
          participantUuid: result.registration.participant.rankedUuid,
          nickname: result.registration.nicknameSnapshot,
          avatarUrl: `https://mc-heads.net/avatar/${result.registration.participant.rankedUuid}/40`,
          status: result.status,
          placement: result.placement,
          timeMs: result.rawTimeMs,
          effectiveTimeMs: result.effectiveTimeMs,
          lastPhase: result.lastPhase,
          timeline: parseTimeline(result.timeline),
        }))
    )

    return {
      data: {
        id: match.id,
        matchNumber: match.matchNumber,
        rankedMatchId: match.rankedMatchId,
        completionLimit:
          match.completionLimit as QualificationCompletionLimit | null,
        timeLimitMs: match.division.timeLimitMs,
        results,
      },
    }
  }

  async getParticipant(registrationId: string) {
    const registration = await this.prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: { participant: true },
    })
    if (!registration) {
      throw new NotFoundException("Участник турнира не найден.")
    }

    const [division, divisionRegistrations, qualificationMatches] =
      await Promise.all([
        this.prisma.division.findUniqueOrThrow({
          where: { id: registration.divisionId },
          select: { type: true, timeLimitMs: true },
        }),
        this.prisma.tournamentRegistration.findMany({
          where: { divisionId: registration.divisionId },
          select: { id: true, nicknameSnapshot: true },
        }),
        this.prisma.qualificationMatch.findMany({
          where: {
            divisionId: registration.divisionId,
            activeImportId: { not: null },
          },
          orderBy: { matchNumber: "asc" },
          select: {
            id: true,
            matchNumber: true,
            activeImport: {
              select: {
                results: {
                  select: {
                    registrationId: true,
                    points: true,
                    effectiveTimeMs: true,
                    status: true,
                    placement: true,
                    rawTimeMs: true,
                  },
                },
              },
            },
          },
        }),
      ])
    const calculated = calculateQualificationStandings({
      divisionType: division.type,
      timeLimitMs: division.timeLimitMs,
      registrations: divisionRegistrations.map((candidate) => ({
        id: candidate.id,
        nickname: candidate.nicknameSnapshot,
      })),
      matches: qualificationMatches.flatMap((match) =>
        match.activeImport
          ? [
              {
                matchNumber: match.matchNumber,
                results: match.activeImport.results,
              },
            ]
          : []
      ),
    })
    const participantStanding = calculated.find(
      (candidate) => candidate.registrationId === registration.id
    )
    const rank =
      calculated.findIndex(
        (candidate) => candidate.registrationId === registration.id
      ) + 1
    const matches: ParticipantMatchResult[] = qualificationMatches.flatMap(
      (match) => {
        if (
          participantStanding?.eliminatedAfterMatch !== null &&
          participantStanding?.eliminatedAfterMatch !== undefined &&
          match.matchNumber > participantStanding.eliminatedAfterMatch
        ) {
          return []
        }
        const result = match.activeImport?.results.find(
          (candidate) => candidate.registrationId === registration.id
        )
        return [
          {
            matchId: match.id,
            matchNumber: match.matchNumber,
            status: result?.status ?? "MISSED",
            placement: result?.placement ?? null,
            timeMs: result?.rawTimeMs ?? null,
            points: result?.points ?? 0,
          },
        ]
      }
    )

    return {
      data: {
        rank,
        nickname: registration.nicknameSnapshot,
        participantUuid: registration.participant.rankedUuid,
        points: registration.qualificationPoints,
        averageTimeMs: registration.averageTimeMs,
        matches,
      },
    }
  }

  private async getEligibleRegistrationIds(
    division: {
      id: string
      type: "BEGINNER" | "EXPERIENCED" | "PRO"
      timeLimitMs: number
    },
    matchNumber: number
  ) {
    const [registrations, matches] = await Promise.all([
      this.prisma.tournamentRegistration.findMany({
        where: { divisionId: division.id },
        select: { id: true, nicknameSnapshot: true },
      }),
      this.prisma.qualificationMatch.findMany({
        where: {
          divisionId: division.id,
          matchNumber: { lt: matchNumber },
          activeImportId: { not: null },
        },
        orderBy: { matchNumber: "asc" },
        select: {
          matchNumber: true,
          activeImport: {
            select: {
              results: {
                select: {
                  registrationId: true,
                  points: true,
                  effectiveTimeMs: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
    ])

    return eligibleRegistrationIdsBeforeMatch({
      divisionType: division.type,
      timeLimitMs: division.timeLimitMs,
      registrations: registrations.map((registration) => ({
        id: registration.id,
        nickname: registration.nicknameSnapshot,
      })),
      matches: matches.flatMap((match) =>
        match.activeImport
          ? [
              {
                matchNumber: match.matchNumber,
                results: match.activeImport.results,
              },
            ]
          : []
      ),
      matchNumber,
    })
  }
}
