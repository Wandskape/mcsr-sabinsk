import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type { AdminTournament } from "@mcsr-sabinsk/shared"

import type { Prisma } from "../../generated/prisma/client.js"
import {
  DivisionType,
  PlayoffMatchKind,
  PlayoffMatchStatus,
  TournamentStatus,
} from "../../generated/prisma/enums.js"
import { AuditService } from "../audit/audit.service.js"
import { MediaService } from "../media/media.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { ChangeTournamentStatusDto } from "./dto/change-tournament-status.dto.js"
import type { CreateTournamentDto } from "./dto/create-tournament.dto.js"
import type { RemoveTournamentCoverDto } from "./dto/remove-tournament-cover.dto.js"
import type { SetTournamentCoverDto } from "./dto/set-tournament-cover.dto.js"
import type { UpdateTournamentDto } from "./dto/update-tournament.dto.js"
import {
  assertStatusTransition,
  assertValidDateRange,
  participatingDivisionIds,
} from "./tournament-policy.js"

const adminTournamentInclude = {
  divisions: {
    include: {
      playoffBracket: {
        select: { id: true },
      },
      qualificationMatches: {
        where: { activeImportId: { not: null } },
        select: { id: true },
        take: 1,
      },
      _count: {
        select: {
          registrations: true,
          qualificationMatches: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.TournamentInclude

type AdminTournamentRecord = Prisma.TournamentGetPayload<{
  include: typeof adminTournamentInclude
}>

interface AdminMutationContext {
  adminUserId: string
  requestId: string
}

const DIVISIONS = [
  {
    type: DivisionType.BEGINNER,
    displayName: "Новички",
    sortOrder: 1,
  },
  {
    type: DivisionType.EXPERIENCED,
    displayName: "Опытные",
    sortOrder: 2,
  },
  {
    type: DivisionType.PRO,
    displayName: "Про",
    sortOrder: 3,
  },
] as const

function prismaErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code
  }
  return null
}

function snapshot(tournament: AdminTournamentRecord): Prisma.InputJsonValue {
  return {
    id: tournament.id,
    name: tournament.name,
    slug: tournament.slug,
    description: tournament.description,
    startsAt: tournament.startsAt.toISOString(),
    endsAt: tournament.endsAt.toISOString(),
    status: tournament.status,
    coverObjectKey: tournament.coverObjectKey,
    coverUrl: tournament.coverUrl,
    version: tournament.version,
    completedAt: tournament.completedAt?.toISOString() ?? null,
    divisions: tournament.divisions.map((division) => ({
      id: division.id,
      type: division.type,
      displayName: division.displayName,
      timeLimitMs: division.timeLimitMs,
      isParticipating: division.isParticipating,
      version: division.version,
    })),
  }
}

@Injectable()
export class AdminTournamentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MediaService) private readonly media: MediaService
  ) {}

  async list() {
    const tournaments = await this.prisma.tournament.findMany({
      include: adminTournamentInclude,
      orderBy: [{ startsAt: "desc" }, { name: "asc" }],
    })
    return { data: tournaments.map((tournament) => this.map(tournament)) }
  }

  async get(id: string) {
    return { data: this.map(await this.find(id)) }
  }

  async create(input: CreateTournamentDto, context: AdminMutationContext) {
    const startsAt = new Date(input.startsAt)
    const endsAt = new Date(input.endsAt)
    assertValidDateRange(startsAt, endsAt)

    try {
      const tournament = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.tournament.create({
          data: {
            name: input.name.trim(),
            slug: input.slug.trim(),
            description: input.description.trim(),
            startsAt,
            endsAt,
            status: TournamentStatus.DRAFT,
            divisions: {
              create: DIVISIONS.map((division) => ({
                ...division,
                timeLimitMs: input.divisionTimeLimitsMs[division.type],
              })),
            },
          },
          include: adminTournamentInclude,
        })

        await this.audit.record(
          {
            adminUserId: context.adminUserId,
            action: "TOURNAMENT_CREATED",
            entityType: "Tournament",
            entityId: created.id,
            requestId: context.requestId,
            after: snapshot(created),
          },
          transaction
        )

        return created
      })

      return { data: this.map(tournament) }
    } catch (error) {
      this.rethrowWriteError(error)
    }
  }

  async update(
    id: string,
    input: UpdateTournamentDto,
    context: AdminMutationContext
  ) {
    const current = await this.find(id)
    this.assertEditable(current)
    this.assertVersion(current.version, input.expectedVersion)
    if (
      current.status !== TournamentStatus.DRAFT &&
      input.slug.trim() !== current.slug
    ) {
      throw new BadRequestException(
        "Slug нельзя менять после первой публикации турнира."
      )
    }

    const startsAt = new Date(input.startsAt)
    const endsAt = new Date(input.endsAt)
    assertValidDateRange(startsAt, endsAt)

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const result = await transaction.tournament.updateMany({
          where: { id, version: input.expectedVersion },
          data: {
            name: input.name.trim(),
            slug: input.slug.trim(),
            description: input.description.trim(),
            startsAt,
            endsAt,
            version: { increment: 1 },
          },
        })
        if (result.count !== 1) {
          throw new ConflictException(
            "Турнир уже изменён в другой вкладке. Обновите страницу."
          )
        }

        await Promise.all(
          DIVISIONS.map((division) =>
            transaction.division.update({
              where: {
                tournamentId_type: {
                  tournamentId: id,
                  type: division.type,
                },
              },
              data: {
                timeLimitMs: input.divisionTimeLimitsMs[division.type],
                version: { increment: 1 },
              },
            })
          )
        )

        const tournament = await transaction.tournament.findUniqueOrThrow({
          where: { id },
          include: adminTournamentInclude,
        })
        await this.audit.record(
          {
            adminUserId: context.adminUserId,
            action: "TOURNAMENT_UPDATED",
            entityType: "Tournament",
            entityId: id,
            requestId: context.requestId,
            before: snapshot(current),
            after: snapshot(tournament),
          },
          transaction
        )
        return tournament
      })

      return { data: this.map(updated) }
    } catch (error) {
      this.rethrowWriteError(error)
    }
  }

  async changeStatus(
    id: string,
    input: ChangeTournamentStatusDto,
    context: AdminMutationContext
  ) {
    const current = await this.find(id)
    this.assertVersion(current.version, input.expectedVersion)
    assertStatusTransition(current.status, input.status)
    await this.assertStatusRequirements(current, input.status)

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.tournament.updateMany({
        where: { id, version: input.expectedVersion },
        data: {
          status: input.status,
          completedAt:
            input.status === TournamentStatus.COMPLETED ? new Date() : null,
          version: { increment: 1 },
        },
      })
      if (result.count !== 1) {
        throw new ConflictException(
          "Статус уже изменён в другой вкладке. Обновите страницу."
        )
      }

      if (input.status === TournamentStatus.QUALIFICATION) {
        const divisions = await transaction.division.findMany({
          where: { tournamentId: id },
          select: {
            id: true,
            _count: { select: { registrations: true } },
          },
        })
        const participatingIds = participatingDivisionIds(
          divisions.map((division) => ({
            id: division.id,
            registrationCount: division._count.registrations,
          }))
        )
        await transaction.division.updateMany({
          where: { tournamentId: id },
          data: {
            isParticipating: false,
            version: { increment: 1 },
          },
        })
        await transaction.division.updateMany({
          where: { id: { in: participatingIds } },
          data: { isParticipating: true },
        })
      }

      const tournament = await transaction.tournament.findUniqueOrThrow({
        where: { id },
        include: adminTournamentInclude,
      })
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: "TOURNAMENT_STATUS_CHANGED",
          entityType: "Tournament",
          entityId: id,
          requestId: context.requestId,
          before: snapshot(current),
          after: snapshot(tournament),
        },
        transaction
      )
      return tournament
    })

    return { data: this.map(updated) }
  }

  async setCover(
    id: string,
    input: SetTournamentCoverDto,
    context: AdminMutationContext
  ) {
    const current = await this.find(id)
    this.assertEditable(current)
    this.assertVersion(current.version, input.expectedVersion)
    await this.media.assertObjectExists(input.objectKey)
    const coverUrl = this.media.publicUrlFor(input.objectKey)

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.tournament.updateMany({
        where: { id, version: input.expectedVersion },
        data: {
          coverObjectKey: input.objectKey,
          coverUrl,
          version: { increment: 1 },
        },
      })
      if (result.count !== 1) {
        throw new ConflictException(
          "Турнир уже изменён в другой вкладке. Обновите страницу."
        )
      }
      const tournament = await transaction.tournament.findUniqueOrThrow({
        where: { id },
        include: adminTournamentInclude,
      })
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: "TOURNAMENT_COVER_SET",
          entityType: "Tournament",
          entityId: id,
          requestId: context.requestId,
          before: snapshot(current),
          after: snapshot(tournament),
        },
        transaction
      )
      return tournament
    })

    return { data: this.map(updated) }
  }

  async removeCover(
    id: string,
    input: RemoveTournamentCoverDto,
    context: AdminMutationContext
  ) {
    const current = await this.find(id)
    this.assertEditable(current)
    this.assertVersion(current.version, input.expectedVersion)
    if (!current.coverObjectKey) {
      throw new BadRequestException("У турнира нет обложки.")
    }
    if (current.status !== TournamentStatus.DRAFT) {
      throw new BadRequestException(
        "У опубликованного турнира обложку можно только заменить."
      )
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.tournament.updateMany({
        where: { id, version: input.expectedVersion },
        data: {
          coverObjectKey: null,
          coverUrl: null,
          version: { increment: 1 },
        },
      })
      if (result.count !== 1) {
        throw new ConflictException(
          "Турнир уже изменён в другой вкладке. Обновите страницу."
        )
      }
      const tournament = await transaction.tournament.findUniqueOrThrow({
        where: { id },
        include: adminTournamentInclude,
      })
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: "TOURNAMENT_COVER_REMOVED",
          entityType: "Tournament",
          entityId: id,
          requestId: context.requestId,
          before: snapshot(current),
          after: snapshot(tournament),
        },
        transaction
      )
      return tournament
    })

    return { data: this.map(updated) }
  }

  async delete(
    id: string,
    expectedVersion: number,
    context: AdminMutationContext
  ) {
    const current = await this.find(id)
    this.assertVersion(current.version, expectedVersion)
    if (current.status !== TournamentStatus.DRAFT) {
      throw new BadRequestException("Удалить можно только черновик.")
    }
    if (
      current.coverObjectKey ||
      current.divisions.some(
        (division) =>
          division._count.registrations > 0 ||
          division._count.qualificationMatches > 0 ||
          division.playoffBracket !== null
      )
    ) {
      throw new BadRequestException(
        "Удалить можно только пустой черновик без обложки и турнирных данных."
      )
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.division.deleteMany({ where: { tournamentId: id } })
      const result = await transaction.tournament.deleteMany({
        where: { id, version: expectedVersion },
      })
      if (result.count !== 1) {
        throw new ConflictException(
          "Турнир уже изменён в другой вкладке. Обновите страницу."
        )
      }
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: "TOURNAMENT_DELETED",
          entityType: "Tournament",
          entityId: id,
          requestId: context.requestId,
          before: snapshot(current),
        },
        transaction
      )
    })
  }

  private async find(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: adminTournamentInclude,
    })
    if (!tournament) {
      throw new NotFoundException("Турнир не найден.")
    }
    return tournament
  }

  private async assertStatusRequirements(
    tournament: AdminTournamentRecord,
    nextStatus: TournamentStatus
  ) {
    if (nextStatus === TournamentStatus.UPCOMING) {
      if (
        !tournament.name.trim() ||
        !tournament.description.trim() ||
        !tournament.coverObjectKey ||
        !tournament.coverUrl
      ) {
        throw new BadRequestException(
          "Для публикации заполните название, описание и загрузите обложку."
        )
      }
      assertValidDateRange(tournament.startsAt, tournament.endsAt)
    }

    if (nextStatus === TournamentStatus.QUALIFICATION) {
      participatingDivisionIds(
        tournament.divisions.map((division) => ({
          id: division.id,
          registrationCount: division._count.registrations,
        }))
      )
    }

    if (
      tournament.status === TournamentStatus.QUALIFICATION &&
      nextStatus === TournamentStatus.COMPLETED
    ) {
      const bracketCount = await this.prisma.playoffBracket.count({
        where: { division: { tournamentId: tournament.id } },
      })
      if (bracketCount > 0) {
        throw new BadRequestException(
          "У турнира уже есть сетки плей-офф. Переведите его в плей-офф."
        )
      }
    }

    if (nextStatus === TournamentStatus.COMPLETED) {
      const incompleteMatches = await this.prisma.playoffMatch.count({
        where: {
          bracket: {
            division: { tournamentId: tournament.id },
            isPublished: true,
          },
          status: { not: PlayoffMatchStatus.COMPLETED },
          OR: [
            { kind: PlayoffMatchKind.MAIN },
            {
              kind: PlayoffMatchKind.THIRD_PLACE,
              bracket: { showThirdPlace: true },
            },
          ],
        },
      })
      if (incompleteMatches > 0) {
        throw new BadRequestException(
          "Сначала завершите все матчи опубликованных сеток."
        )
      }
    }
  }

  private assertEditable(tournament: AdminTournamentRecord) {
    if (tournament.status === TournamentStatus.COMPLETED) {
      throw new ForbiddenException("Завершённый турнир нельзя изменять.")
    }
  }

  private assertVersion(current: number, expected: number) {
    if (current !== expected) {
      throw new ConflictException(
        "Турнир уже изменён в другой вкладке. Обновите страницу."
      )
    }
  }

  private rethrowWriteError(error: unknown): never {
    if (prismaErrorCode(error) === "P2002") {
      throw new ConflictException("Турнир с таким slug уже существует.")
    }
    throw error
  }

  private map(tournament: AdminTournamentRecord): AdminTournament {
    return {
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      description: tournament.description,
      startsAt: tournament.startsAt.toISOString(),
      endsAt: tournament.endsAt.toISOString(),
      status: tournament.status,
      coverObjectKey: tournament.coverObjectKey,
      coverUrl: tournament.coverUrl,
      version: tournament.version,
      completedAt: tournament.completedAt?.toISOString() ?? null,
      divisions: tournament.divisions.map((division) => ({
        id: division.id,
        type: division.type,
        displayName: division.displayName,
        timeLimitMs: division.timeLimitMs,
        isParticipating: division.isParticipating,
        version: division.version,
        registrationCount: division._count.registrations,
        qualificationMatchCount: division._count.qualificationMatches,
        rosterLocked: division.qualificationMatches.length > 0,
      })),
    }
  }
}
