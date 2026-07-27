import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import type {
  ParticipantMatchResult,
  TimelineSegment,
} from "@mcsr-sabinsk/shared"

import { PrismaService } from "../prisma/prisma.service.js"
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
          select: { timeLimitMs: true },
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

    const results = sortQualificationMatchResults(
      match.activeImport.results.map((result) => ({
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
        timeLimitMs: match.division.timeLimitMs,
        results,
      },
    }
  }

  async getParticipant(registrationId: string) {
    const registration = await this.prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        participant: true,
        qualificationResults: {
          include: { qualificationMatch: true },
        },
      },
    })
    if (!registration) {
      throw new NotFoundException("Участник турнира не найден.")
    }

    const activeResults = registration.qualificationResults.filter(
      (result) => result.qualificationMatch.activeImportId === result.importId
    )
    const divisionRegistrations =
      await this.prisma.tournamentRegistration.findMany({
        where: { divisionId: registration.divisionId },
        orderBy: [
          { qualificationPoints: "desc" },
          { averageTimeMs: "asc" },
          { nicknameSnapshot: "asc" },
        ],
      })
    const rank =
      divisionRegistrations.findIndex(
        (candidate) => candidate.id === registration.id
      ) + 1
    const matches: ParticipantMatchResult[] = activeResults
      .map((result) => ({
        matchId: result.qualificationMatchId,
        matchNumber: result.qualificationMatch.matchNumber,
        status: result.status,
        placement: result.placement,
        timeMs: result.rawTimeMs,
        points: result.points,
      }))
      .sort((left, right) => left.matchNumber - right.matchNumber)

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
}
