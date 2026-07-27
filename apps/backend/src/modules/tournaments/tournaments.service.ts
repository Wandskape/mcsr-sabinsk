import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import type {
  PublicTournament,
  QualificationMatchSummary,
  Standing,
} from "@mcsr-sabinsk/shared"

import type { DivisionType, Prisma } from "../../generated/prisma/client.js"
import { TournamentStatus } from "../../generated/prisma/client.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { isDivisionPublic } from "./division-visibility.js"
import type { ListTournamentsQueryDto } from "./dto/list-tournaments-query.dto.js"
import { selectDefaultTournament } from "./tournament-selection.js"

const publicTournamentInclude = {
  divisions: {
    orderBy: { sortOrder: "asc" },
    include: {
      playoffBracket: {
        select: { isPublished: true },
      },
    },
  },
} satisfies Prisma.TournamentInclude

type PublicTournamentRecord = Prisma.TournamentGetPayload<{
  include: typeof publicTournamentInclude
}>

@Injectable()
export class TournamentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ListTournamentsQueryDto) {
    const statuses = (query.status ?? Object.values(TournamentStatus)).filter(
      (status) => status !== TournamentStatus.DRAFT
    )
    const take = query.limit ?? 20
    const tournaments = await this.prisma.tournament.findMany({
      where: { status: { in: statuses } },
      include: publicTournamentInclude,
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
    })
    const hasMore = tournaments.length > take
    const page = tournaments.slice(0, take)

    return {
      data: page.map((tournament) => this.toPublicTournament(tournament)),
      meta: {
        nextCursor: hasMore ? page.at(-1)?.id : null,
      },
    }
  }

  async getDefault() {
    const tournaments = await this.prisma.tournament.findMany({
      where: { status: { not: TournamentStatus.DRAFT } },
      include: publicTournamentInclude,
    })
    const selected = selectDefaultTournament(tournaments)
    if (!selected) {
      throw new NotFoundException("Опубликованные турниры пока не добавлены.")
    }

    return { data: this.toPublicTournament(selected) }
  }

  async getBySlug(slug: string) {
    const tournament = await this.prisma.tournament.findFirst({
      where: {
        slug,
        status: { not: TournamentStatus.DRAFT },
      },
      include: publicTournamentInclude,
    })
    if (!tournament) {
      throw new NotFoundException("Турнир не найден.")
    }

    return { data: this.toPublicTournament(tournament) }
  }

  async getStandings(slug: string, divisionType: DivisionType) {
    const division = await this.findPublicDivision(slug, divisionType)
    const registrations = await this.prisma.tournamentRegistration.findMany({
      where: { divisionId: division.id },
      include: { participant: true },
    })
    registrations.sort((left, right) => {
      const pointsDifference =
        right.qualificationPoints - left.qualificationPoints
      if (pointsDifference !== 0) return pointsDifference

      const leftAverage = left.averageTimeMs ?? Number.POSITIVE_INFINITY
      const rightAverage = right.averageTimeMs ?? Number.POSITIVE_INFINITY
      if (leftAverage !== rightAverage) return leftAverage - rightAverage

      return left.nicknameSnapshot.localeCompare(right.nicknameSnapshot, "ru", {
        sensitivity: "base",
      })
    })

    const standings: Standing[] = registrations.map((registration, index) => ({
      rank: index + 1,
      registrationId: registration.id,
      participantUuid: registration.participant.rankedUuid,
      nickname: registration.nicknameSnapshot,
      points: registration.qualificationPoints,
      averageTimeMs: registration.averageTimeMs,
      playedMatches: registration.playedMatches,
      dnfCount: registration.dnfCount,
      missedCount: registration.missedCount,
    }))

    return {
      data: {
        division: {
          type: division.type,
          displayName: division.displayName,
          timeLimitMs: division.timeLimitMs,
        },
        standings,
      },
    }
  }

  async getMatches(slug: string, divisionType: DivisionType) {
    const division = await this.findPublicDivision(slug, divisionType)
    const matches = await this.prisma.qualificationMatch.findMany({
      where: {
        divisionId: division.id,
        activeImportId: { not: null },
      },
      orderBy: { matchNumber: "asc" },
      include: {
        winner: true,
        activeImport: {
          select: { importVersion: true },
        },
      },
    })

    const result: QualificationMatchSummary[] = matches.map((match) => ({
      id: match.id,
      matchNumber: match.matchNumber,
      rankedMatchId: match.rankedMatchId,
      playedAt: match.rankedPlayedAt?.toISOString() ?? null,
      winner: match.winner
        ? {
            registrationId: match.winner.id,
            nickname: match.winner.nicknameSnapshot,
          }
        : null,
      importVersion: match.activeImport?.importVersion ?? 0,
    }))

    return { data: result }
  }

  private async findPublicDivision(slug: string, type: DivisionType) {
    const division = await this.prisma.division.findFirst({
      where: {
        type,
        tournament: {
          slug,
          status: { not: TournamentStatus.DRAFT },
        },
      },
      include: {
        tournament: {
          select: { status: true },
        },
      },
    })
    if (
      !division ||
      !isDivisionPublic(division.tournament.status, division.isParticipating)
    ) {
      throw new NotFoundException("Дивизион турнира не найден.")
    }
    return division
  }

  private toPublicTournament(
    tournament: PublicTournamentRecord
  ): PublicTournament {
    if (tournament.status === TournamentStatus.DRAFT) {
      throw new Error("Draft tournament cannot be mapped to a public response")
    }

    const visibleDivisions = tournament.divisions.filter((division) =>
      isDivisionPublic(tournament.status, division.isParticipating)
    )

    return {
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      description: tournament.description,
      startsAt: tournament.startsAt.toISOString(),
      endsAt: tournament.endsAt.toISOString(),
      status: tournament.status,
      coverUrl: tournament.coverUrl,
      divisions: visibleDivisions.map((division) => ({
        id: division.id,
        type: division.type,
        displayName: division.displayName,
        timeLimitMs: division.timeLimitMs,
        hasPublishedPlayoff: division.playoffBracket?.isPublished === true,
      })),
    }
  }
}
