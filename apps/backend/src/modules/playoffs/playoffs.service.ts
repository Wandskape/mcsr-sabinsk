import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type {
  AdminPlayoff,
  PlayoffMatch,
  PlayoffRound,
  PublicPlayoff,
} from "@mcsr-sabinsk/shared"

import type { DivisionType, Prisma } from "../../generated/prisma/client.js"
import {
  PlayoffMatchKind,
  PlayoffMatchStatus,
  TournamentStatus,
} from "../../generated/prisma/enums.js"
import { AuditService } from "../audit/audit.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreatePlayoffDto } from "./dto/create-playoff.dto.js"
import type { UpdatePlayoffMatchDto } from "./dto/update-playoff-match.dto.js"
import type { UpdatePlayoffSeedsDto } from "./dto/update-playoff-seeds.dto.js"
import type { UpdatePlayoffDto } from "./dto/update-playoff.dto.js"
import {
  createMatchSlots,
  playoffRoundName,
  validateMatchState,
} from "./playoff-domain.js"

const bracketInclude = {
  division: {
    include: {
      tournament: true,
      registrations: {
        orderBy: [
          { qualificationPoints: "desc" as const },
          { averageTimeMs: "asc" as const },
          { nicknameSnapshot: "asc" as const },
        ],
      },
    },
  },
  seeds: {
    orderBy: { seedNumber: "asc" as const },
  },
  matches: {
    include: {
      participant1: true,
      participant2: true,
    },
    orderBy: [
      { kind: "asc" as const },
      { roundNumber: "asc" as const },
      { position: "asc" as const },
    ],
  },
} satisfies Prisma.PlayoffBracketInclude

type BracketRecord = Prisma.PlayoffBracketGetPayload<{
  include: typeof bracketInclude
}>

interface AdminMutationContext {
  adminUserId: string
  requestId: string
}

function snapshot(bracket: BracketRecord): Prisma.InputJsonValue {
  return {
    id: bracket.id,
    divisionId: bracket.divisionId,
    size: bracket.size,
    showThirdPlace: bracket.showThirdPlace,
    isPublished: bracket.isPublished,
    version: bracket.version,
    seeds: bracket.seeds.map((seed) => ({
      seedNumber: seed.seedNumber,
      registrationId: seed.registrationId,
    })),
    matches: bracket.matches.map((match) => ({
      id: match.id,
      kind: match.kind,
      roundNumber: match.roundNumber,
      position: match.position,
      participant1RegistrationId: match.participant1RegistrationId,
      participant2RegistrationId: match.participant2RegistrationId,
      score1: match.score1,
      score2: match.score2,
      winnerRegistrationId: match.winnerRegistrationId,
      status: match.status,
      version: match.version,
    })),
  }
}

@Injectable()
export class PlayoffsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async getAdminByDivision(divisionId: string) {
    const bracket = await this.prisma.playoffBracket.findUnique({
      where: { divisionId },
      include: bracketInclude,
    })
    if (!bracket) {
      throw new NotFoundException("Сетка плей-офф ещё не создана.")
    }
    return { data: this.mapAdmin(bracket) }
  }

  async getAdmin(id: string) {
    return { data: this.mapAdmin(await this.find(id)) }
  }

  async create(
    divisionId: string,
    input: CreatePlayoffDto,
    context: AdminMutationContext
  ) {
    const division = await this.prisma.division.findUnique({
      where: { id: divisionId },
      include: {
        tournament: true,
        playoffBracket: { select: { id: true } },
        _count: { select: { registrations: true } },
      },
    })
    if (!division) {
      throw new NotFoundException("Дивизион не найден.")
    }
    if (
      division.tournament.status !== TournamentStatus.QUALIFICATION &&
      division.tournament.status !== TournamentStatus.PLAYOFF
    ) {
      throw new BadRequestException(
        "Сетку можно создать во время квалификации или плей-офф."
      )
    }
    if (!division.isParticipating) {
      throw new BadRequestException("Этот дивизион не участвует в турнире.")
    }
    this.assertVersion(
      division.version,
      input.expectedDivisionVersion,
      "Дивизион"
    )
    if (division.playoffBracket) {
      throw new ConflictException("Для дивизиона уже создана сетка.")
    }
    if (division._count.registrations < input.size) {
      throw new BadRequestException(
        `Для сетки на ${input.size} игроков в дивизионе недостаточно участников.`
      )
    }

    const created = await this.prisma.$transaction(async (transaction) => {
      const divisionUpdate = await transaction.division.updateMany({
        where: { id: divisionId, version: input.expectedDivisionVersion },
        data: { version: { increment: 1 } },
      })
      if (divisionUpdate.count !== 1) {
        throw new ConflictException(
          "Дивизион уже изменён в другой вкладке. Обновите страницу."
        )
      }

      const bracket = await transaction.playoffBracket.create({
        data: {
          divisionId,
          size: input.size,
          showThirdPlace: input.showThirdPlace,
          seeds: {
            create: Array.from({ length: input.size }, (_, index) => ({
              seedNumber: index + 1,
            })),
          },
          matches: {
            create: createMatchSlots(input.size, true).map((slot) => ({
              ...slot,
              status: PlayoffMatchStatus.EMPTY,
            })),
          },
        },
        include: bracketInclude,
      })
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: "PLAYOFF_CREATED",
          entityType: "PlayoffBracket",
          entityId: bracket.id,
          requestId: context.requestId,
          after: snapshot(bracket),
        },
        transaction
      )
      return bracket
    })

    return { data: this.mapAdmin(created) }
  }

  async update(
    id: string,
    input: UpdatePlayoffDto,
    context: AdminMutationContext
  ) {
    const current = await this.find(id)
    this.assertEditable(current)
    this.assertVersion(current.version, input.expectedVersion, "Сетка")

    const updated = await this.prisma.$transaction(async (transaction) => {
      if (input.showThirdPlace) {
        await transaction.playoffMatch.upsert({
          where: {
            bracketId_kind_roundNumber_position: {
              bracketId: id,
              kind: PlayoffMatchKind.THIRD_PLACE,
              roundNumber: Math.log2(current.size),
              position: 1,
            },
          },
          create: {
            bracketId: id,
            kind: PlayoffMatchKind.THIRD_PLACE,
            roundNumber: Math.log2(current.size),
            position: 1,
            status: PlayoffMatchStatus.EMPTY,
          },
          update: {},
        })
      }
      const result = await transaction.playoffBracket.updateMany({
        where: { id, version: input.expectedVersion },
        data: {
          showThirdPlace: input.showThirdPlace,
          version: { increment: 1 },
        },
      })
      if (result.count !== 1) {
        throw new ConflictException(
          "Сетка уже изменена в другой вкладке. Обновите страницу."
        )
      }
      const bracket = await transaction.playoffBracket.findUniqueOrThrow({
        where: { id },
        include: bracketInclude,
      })
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: "PLAYOFF_UPDATED",
          entityType: "PlayoffBracket",
          entityId: id,
          requestId: context.requestId,
          before: snapshot(current),
          after: snapshot(bracket),
        },
        transaction
      )
      return bracket
    })
    return { data: this.mapAdmin(updated) }
  }

  async updateSeeds(
    id: string,
    input: UpdatePlayoffSeedsDto,
    context: AdminMutationContext
  ) {
    const current = await this.find(id)
    this.assertEditable(current)
    this.assertVersion(current.version, input.expectedVersion, "Сетка")
    const numbers = new Set(input.seeds.map((seed) => seed.seedNumber))
    const registrations = input.seeds
      .map((seed) => seed.registrationId)
      .filter((value): value is string => value !== null)
    if (
      input.seeds.length !== current.size ||
      numbers.size !== current.size ||
      [...numbers].some((number) => number < 1 || number > current.size)
    ) {
      throw new BadRequestException(
        `Передайте ровно ${current.size} уникальных позиций посева.`
      )
    }
    if (new Set(registrations).size !== registrations.length) {
      throw new BadRequestException(
        "Один участник не может занимать две позиции посева."
      )
    }
    await this.assertRegistrations(current.divisionId, registrations)

    const updated = await this.prisma.$transaction(async (transaction) => {
      for (const seed of input.seeds) {
        await transaction.playoffSeed.update({
          where: {
            bracketId_seedNumber: {
              bracketId: id,
              seedNumber: seed.seedNumber,
            },
          },
          data: { registrationId: seed.registrationId },
        })
      }
      const result = await transaction.playoffBracket.updateMany({
        where: { id, version: input.expectedVersion },
        data: { version: { increment: 1 } },
      })
      if (result.count !== 1) {
        throw new ConflictException(
          "Сетка уже изменена в другой вкладке. Обновите страницу."
        )
      }
      const bracket = await transaction.playoffBracket.findUniqueOrThrow({
        where: { id },
        include: bracketInclude,
      })
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: "PLAYOFF_SEEDS_UPDATED",
          entityType: "PlayoffBracket",
          entityId: id,
          requestId: context.requestId,
          before: snapshot(current),
          after: snapshot(bracket),
        },
        transaction
      )
      return bracket
    })
    return { data: this.mapAdmin(updated) }
  }

  async updateMatch(
    matchId: string,
    input: UpdatePlayoffMatchDto,
    context: AdminMutationContext
  ) {
    const match = await this.prisma.playoffMatch.findUnique({
      where: { id: matchId },
      include: {
        bracket: {
          include: {
            division: { include: { tournament: true } },
          },
        },
      },
    })
    if (!match) {
      throw new NotFoundException("Матч плей-офф не найден.")
    }
    if (
      match.bracket.division.tournament.status === TournamentStatus.COMPLETED
    ) {
      throw new ForbiddenException("Завершённый турнир нельзя изменять.")
    }
    this.assertVersion(match.version, input.expectedVersion, "Матч")

    const state = {
      participant1RegistrationId: input.participant1RegistrationId ?? null,
      participant2RegistrationId: input.participant2RegistrationId ?? null,
      score1: input.score1 ?? null,
      score2: input.score2 ?? null,
      winnerRegistrationId: input.winnerRegistrationId ?? null,
      status: input.status,
    }
    const validationError = validateMatchState(state)
    if (validationError) {
      throw new BadRequestException(validationError)
    }
    const registrations = [
      state.participant1RegistrationId,
      state.participant2RegistrationId,
    ].filter((value): value is string => value !== null)
    await this.assertRegistrations(match.bracket.divisionId, registrations)
    await this.assertNoRoundDuplicates(match, registrations)

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.playoffMatch.updateMany({
        where: { id: matchId, version: input.expectedVersion },
        data: {
          ...state,
          version: { increment: 1 },
        },
      })
      if (result.count !== 1) {
        throw new ConflictException(
          "Матч уже изменён в другой вкладке. Обновите страницу."
        )
      }
      await transaction.playoffBracket.update({
        where: { id: match.bracketId },
        data: { version: { increment: 1 } },
      })
      const bracket = await transaction.playoffBracket.findUniqueOrThrow({
        where: { id: match.bracketId },
        include: bracketInclude,
      })
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: "PLAYOFF_MATCH_UPDATED",
          entityType: "PlayoffMatch",
          entityId: matchId,
          requestId: context.requestId,
          before: {
            participant1RegistrationId: match.participant1RegistrationId,
            participant2RegistrationId: match.participant2RegistrationId,
            score1: match.score1,
            score2: match.score2,
            winnerRegistrationId: match.winnerRegistrationId,
            status: match.status,
            version: match.version,
          },
          after: snapshot(bracket),
        },
        transaction
      )
      return bracket
    })
    return { data: this.mapAdmin(updated) }
  }

  async publish(
    id: string,
    expectedVersion: number,
    isPublished: boolean,
    context: AdminMutationContext
  ) {
    const current = await this.find(id)
    this.assertEditable(current)
    this.assertVersion(current.version, expectedVersion, "Сетка")
    if (isPublished) {
      const firstRound = current.matches.filter(
        (match) =>
          match.kind === PlayoffMatchKind.MAIN && match.roundNumber === 1
      )
      if (
        firstRound.length !== current.size / 2 ||
        firstRound.some(
          (match) =>
            !match.participant1RegistrationId ||
            !match.participant2RegistrationId
        )
      ) {
        throw new BadRequestException(
          "Перед публикацией заполните всех участников первого раунда."
        )
      }
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.playoffBracket.updateMany({
        where: { id, version: expectedVersion },
        data: { isPublished, version: { increment: 1 } },
      })
      if (result.count !== 1) {
        throw new ConflictException(
          "Сетка уже изменена в другой вкладке. Обновите страницу."
        )
      }
      const bracket = await transaction.playoffBracket.findUniqueOrThrow({
        where: { id },
        include: bracketInclude,
      })
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: isPublished ? "PLAYOFF_PUBLISHED" : "PLAYOFF_UNPUBLISHED",
          entityType: "PlayoffBracket",
          entityId: id,
          requestId: context.requestId,
          before: snapshot(current),
          after: snapshot(bracket),
        },
        transaction
      )
      return bracket
    })
    return { data: this.mapAdmin(updated) }
  }

  async getPublic(slug: string, divisionType: DivisionType) {
    const bracket = await this.prisma.playoffBracket.findFirst({
      where: {
        isPublished: true,
        division: {
          type: divisionType,
          isParticipating: true,
          tournament: {
            slug,
            status: { not: TournamentStatus.DRAFT },
          },
        },
      },
      include: bracketInclude,
    })
    if (!bracket) {
      throw new NotFoundException("Опубликованная сетка плей-офф не найдена.")
    }
    return { data: this.mapPublic(bracket) }
  }

  private async find(id: string) {
    const bracket = await this.prisma.playoffBracket.findUnique({
      where: { id },
      include: bracketInclude,
    })
    if (!bracket) {
      throw new NotFoundException("Сетка плей-офф не найдена.")
    }
    return bracket
  }

  private assertEditable(bracket: BracketRecord) {
    if (bracket.division.tournament.status === TournamentStatus.COMPLETED) {
      throw new ForbiddenException("Завершённый турнир нельзя изменять.")
    }
  }

  private assertVersion(current: number, expected: number, entity: string) {
    if (current !== expected) {
      throw new ConflictException(
        `${entity} уже изменён в другой вкладке. Обновите страницу.`
      )
    }
  }

  private async assertRegistrations(
    divisionId: string,
    registrationIds: string[]
  ) {
    if (registrationIds.length === 0) return
    const count = await this.prisma.tournamentRegistration.count({
      where: { id: { in: registrationIds }, divisionId },
    })
    if (count !== new Set(registrationIds).size) {
      throw new BadRequestException(
        "Все выбранные участники должны быть зарегистрированы в этом дивизионе."
      )
    }
  }

  private async assertNoRoundDuplicates(
    match: {
      id: string
      bracketId: string
      kind: PlayoffMatchKind
      roundNumber: number
    },
    registrationIds: string[]
  ) {
    if (registrationIds.length === 0) return
    const duplicate = await this.prisma.playoffMatch.findFirst({
      where: {
        id: { not: match.id },
        bracketId: match.bracketId,
        kind: match.kind,
        roundNumber: match.roundNumber,
        OR: [
          { participant1RegistrationId: { in: registrationIds } },
          { participant2RegistrationId: { in: registrationIds } },
        ],
      },
      select: { id: true },
    })
    if (duplicate) {
      throw new BadRequestException(
        "Один участник не может играть в двух матчах одного раунда."
      )
    }
  }

  private mapMatch(match: BracketRecord["matches"][number]): PlayoffMatch {
    return {
      id: match.id,
      kind: match.kind,
      roundNumber: match.roundNumber,
      position: match.position,
      participant1: match.participant1
        ? {
            registrationId: match.participant1.id,
            nickname: match.participant1.nicknameSnapshot,
          }
        : null,
      participant2: match.participant2
        ? {
            registrationId: match.participant2.id,
            nickname: match.participant2.nicknameSnapshot,
          }
        : null,
      score1: match.score1,
      score2: match.score2,
      winnerRegistrationId: match.winnerRegistrationId,
      status: match.status,
      version: match.version,
    }
  }

  private mapRounds(bracket: BracketRecord): PlayoffRound[] {
    const rounds = Math.log2(bracket.size)
    return Array.from({ length: rounds }, (_, index) => {
      const roundNumber = index + 1
      return {
        roundNumber,
        name: playoffRoundName(bracket.size, roundNumber),
        matches: bracket.matches
          .filter(
            (match) =>
              match.kind === PlayoffMatchKind.MAIN &&
              match.roundNumber === roundNumber
          )
          .map((match) => this.mapMatch(match)),
      }
    })
  }

  private mapPublic(bracket: BracketRecord): PublicPlayoff {
    const thirdPlace = bracket.matches.find(
      (match) => match.kind === PlayoffMatchKind.THIRD_PLACE
    )
    return {
      size: bracket.size as 4 | 8 | 16,
      showThirdPlace: bracket.showThirdPlace,
      rounds: this.mapRounds(bracket),
      thirdPlaceMatch:
        bracket.showThirdPlace && thirdPlace ? this.mapMatch(thirdPlace) : null,
    }
  }

  private mapAdmin(bracket: BracketRecord): AdminPlayoff {
    const publicBracket = this.mapPublic(bracket)
    return {
      ...publicBracket,
      id: bracket.id,
      divisionId: bracket.divisionId,
      divisionDisplayName: bracket.division.displayName,
      isPublished: bracket.isPublished,
      version: bracket.version,
      registrations: bracket.division.registrations.map((registration) => ({
        registrationId: registration.id,
        nickname: registration.nicknameSnapshot,
        qualificationPoints: registration.qualificationPoints,
        averageTimeMs: registration.averageTimeMs,
      })),
      seeds: bracket.seeds.map((seed) => ({
        seedNumber: seed.seedNumber,
        registrationId: seed.registrationId,
      })),
      warnings: this.warnings(bracket),
    }
  }

  private warnings(bracket: BracketRecord) {
    const warnings: string[] = []
    const nickname = new Map(
      bracket.division.registrations.map((registration) => [
        registration.id,
        registration.nicknameSnapshot,
      ])
    )
    const firstRound = bracket.matches.filter(
      (match) => match.kind === PlayoffMatchKind.MAIN && match.roundNumber === 1
    )
    if (
      firstRound.some(
        (match) =>
          !match.participant1RegistrationId || !match.participant2RegistrationId
      )
    ) {
      warnings.push("Не все участники первого раунда назначены.")
    }

    const roundCount = Math.log2(bracket.size)
    for (let roundNumber = 2; roundNumber <= roundCount; roundNumber += 1) {
      const currentRound = bracket.matches.filter(
        (match) =>
          match.kind === PlayoffMatchKind.MAIN &&
          match.roundNumber === roundNumber
      )
      const previousRound = bracket.matches.filter(
        (match) =>
          match.kind === PlayoffMatchKind.MAIN &&
          match.roundNumber === roundNumber - 1
      )
      for (const match of currentRound) {
        const sourcePositions = [match.position * 2 - 1, match.position * 2]
        const expectedWinners = previousRound
          .filter((previous) => sourcePositions.includes(previous.position))
          .map((previous) => previous.winnerRegistrationId)
          .filter((value): value is string => value !== null)
        const assigned = [
          match.participant1RegistrationId,
          match.participant2RegistrationId,
        ].filter((value): value is string => value !== null)
        for (const registrationId of assigned) {
          if (
            expectedWinners.length > 0 &&
            !expectedWinners.includes(registrationId)
          ) {
            warnings.push(
              `${playoffRoundName(bracket.size, roundNumber)}, матч ${match.position}: ${nickname.get(registrationId) ?? "участник"} не является победителем связанного матча прошлого раунда.`
            )
          }
        }
        if (expectedWinners.length === 2) {
          for (const registrationId of expectedWinners) {
            if (!assigned.includes(registrationId)) {
              warnings.push(
                `${playoffRoundName(bracket.size, roundNumber)}, матч ${match.position}: добавьте победителя ${nickname.get(registrationId) ?? "предыдущего матча"}.`
              )
            }
          }
        }
      }
    }

    if (bracket.showThirdPlace) {
      const semifinals = bracket.matches.filter(
        (match) =>
          match.kind === PlayoffMatchKind.MAIN &&
          match.roundNumber === roundCount - 1 &&
          match.status === PlayoffMatchStatus.COMPLETED
      )
      const expectedLosers = semifinals
        .map((match) =>
          match.participant1RegistrationId === match.winnerRegistrationId
            ? match.participant2RegistrationId
            : match.participant1RegistrationId
        )
        .filter((value): value is string => value !== null)
      const thirdPlace = bracket.matches.find(
        (match) => match.kind === PlayoffMatchKind.THIRD_PLACE
      )
      if (expectedLosers.length === 2 && thirdPlace) {
        const assigned = [
          thirdPlace.participant1RegistrationId,
          thirdPlace.participant2RegistrationId,
        ].filter((value): value is string => value !== null)
        if (
          assigned.length !== 2 ||
          expectedLosers.some(
            (registrationId) => !assigned.includes(registrationId)
          )
        ) {
          warnings.push(
            "Матч за третье место должен содержать проигравших полуфиналов."
          )
        }
      }
    }
    return warnings
  }
}
