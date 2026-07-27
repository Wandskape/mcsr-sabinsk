import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import type {
  AdminRegistration,
  RankedUserProfile,
  RegistrationMutationResult,
  RegistrationMoveResult,
  RegistrationPreview,
  RegistrationPreviewItem,
} from "@mcsr-sabinsk/shared"

import type { Prisma } from "../../generated/prisma/client.js"
import { TournamentStatus } from "../../generated/prisma/enums.js"
import { AuditService } from "../audit/audit.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { RankedService } from "../ranked/ranked.service.js"
import type { MoveRegistrationDto } from "./dto/move-registration.dto.js"

const registrationInclude = {
  participant: true,
} satisfies Prisma.TournamentRegistrationInclude

type RegistrationRecord = Prisma.TournamentRegistrationGetPayload<{
  include: typeof registrationInclude
}>

const divisionScopeInclude = {
  tournament: true,
  qualificationMatches: {
    where: { activeImportId: { not: null } },
    select: { id: true },
    take: 1,
  },
} satisfies Prisma.DivisionInclude

type DivisionScope = Prisma.DivisionGetPayload<{
  include: typeof divisionScopeInclude
}>

interface AdminMutationContext {
  adminUserId: string
  requestId: string
}

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

function safeSnapshot(profile: RankedUserProfile): Prisma.InputJsonValue {
  return {
    uuid: profile.uuid,
    nickname: profile.nickname,
    roleType: profile.roleType,
    eloRate: profile.eloRate,
    eloRank: profile.eloRank,
    country: profile.country,
  }
}

@Injectable()
export class ParticipantsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RankedService) private readonly ranked: RankedService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async resolveUser(identifier: string) {
    const profile = await this.ranked.resolveUser(identifier.trim())
    if (!profile) {
      throw new NotFoundException("Профиль MCSR Ranked не найден.")
    }
    return { data: profile }
  }

  async list(divisionId: string) {
    await this.findDivision(divisionId)
    const registrations = await this.prisma.tournamentRegistration.findMany({
      where: { divisionId },
      include: registrationInclude,
      orderBy: [{ nicknameSnapshot: "asc" }, { id: "asc" }],
    })
    return { data: registrations.map((item) => this.mapRegistration(item)) }
  }

  async preview(
    divisionId: string,
    identifiers: string[]
  ): Promise<{ data: RegistrationPreview }> {
    const division = await this.findDivision(divisionId)
    const normalized = identifiers.map((identifier) => identifier.trim())
    const uniqueIdentifiers: string[] = []
    const seenInput = new Set<string>()
    for (const identifier of normalized) {
      const key = identifier.toLowerCase()
      if (!seenInput.has(key)) {
        seenInput.add(key)
        uniqueIdentifiers.push(identifier)
      }
    }

    const resolved = await this.ranked.resolveUsers(uniqueIdentifiers)
    const profiles = [...resolved.values()].filter(
      (value): value is RankedUserProfile =>
        value !== null && !(value instanceof Error)
    )
    const uuids = [...new Set(profiles.map((profile) => profile.uuid))]
    const nicknames = [
      ...new Set(profiles.map((profile) => profile.nickname.toLowerCase())),
    ]
    const [existingRegistrations, nicknameOwners] = await Promise.all([
      uuids.length
        ? this.prisma.tournamentRegistration.findMany({
            where: {
              tournamentId: division.tournamentId,
              participant: { rankedUuid: { in: uuids } },
            },
            include: {
              participant: { select: { rankedUuid: true } },
              division: { select: { id: true, displayName: true } },
            },
          })
        : [],
      nicknames.length
        ? this.prisma.participant.findMany({
            where: { nicknameLower: { in: nicknames } },
            select: { rankedUuid: true, nicknameLower: true },
          })
        : [],
    ])

    const registrationByUuid = new Map(
      existingRegistrations.map((registration) => [
        registration.participant.rankedUuid,
        registration,
      ])
    )
    const nicknameOwnerByLower = new Map(
      nicknameOwners.map((participant) => [
        participant.nicknameLower,
        participant.rankedUuid,
      ])
    )
    const consumedIdentifiers = new Set<string>()
    const consumedUuids = new Set<string>()

    const items = normalized.map((identifier): RegistrationPreviewItem => {
      const inputKey = identifier.toLowerCase()
      if (consumedIdentifiers.has(inputKey)) {
        return this.previewItem(
          identifier,
          "DUPLICATE_INPUT",
          null,
          null,
          "Этот идентификатор повторяется в списке."
        )
      }
      consumedIdentifiers.add(inputKey)

      const result = resolved.get(
        uniqueIdentifiers.find(
          (candidate) => candidate.toLowerCase() === inputKey
        ) ?? identifier
      )
      if (result instanceof Error) {
        return this.previewItem(identifier, "ERROR", null, null, result.message)
      }
      if (!result) {
        return this.previewItem(
          identifier,
          "NOT_FOUND",
          null,
          null,
          "Профиль Ranked не найден."
        )
      }
      if (consumedUuids.has(result.uuid)) {
        return this.previewItem(
          identifier,
          "DUPLICATE_INPUT",
          result,
          null,
          "Этот UUID уже получен для другой строки списка."
        )
      }
      consumedUuids.add(result.uuid)

      const registration = registrationByUuid.get(result.uuid)
      if (registration) {
        const inCurrentDivision = registration.division.id === divisionId
        return this.previewItem(
          identifier,
          inCurrentDivision ? "ALREADY_REGISTERED" : "CONFLICT",
          result,
          registration.division.displayName,
          inCurrentDivision
            ? "Участник уже добавлен в этот дивизион."
            : `Участник уже находится в дивизионе «${registration.division.displayName}».`
        )
      }

      const nicknameOwner = nicknameOwnerByLower.get(
        result.nickname.toLowerCase()
      )
      if (nicknameOwner && nicknameOwner !== result.uuid) {
        return this.previewItem(
          identifier,
          "CONFLICT",
          result,
          null,
          "Такой ник уже сохранён с другим Ranked UUID."
        )
      }

      return this.previewItem(identifier, "READY", result, null, null)
    })

    return {
      data: {
        divisionId,
        divisionVersion: division.version,
        rosterLocked: this.isRosterLocked(division),
        items,
        readyCount: items.filter((item) => item.status === "READY").length,
      },
    }
  }

  async addOne(
    divisionId: string,
    identifier: string,
    expectedDivisionVersion: number,
    context: AdminMutationContext
  ) {
    return this.addBulk(
      divisionId,
      [identifier],
      expectedDivisionVersion,
      context
    )
  }

  async addBulk(
    divisionId: string,
    identifiers: string[],
    expectedDivisionVersion: number,
    context: AdminMutationContext
  ): Promise<{ data: RegistrationMutationResult }> {
    const division = await this.findDivision(divisionId)
    this.assertRosterEditable(division)
    if (division.version !== expectedDivisionVersion) {
      throw new ConflictException(
        "Состав уже изменён в другой вкладке. Обновите данные."
      )
    }
    const preview = (await this.preview(divisionId, identifiers)).data
    if (preview.divisionVersion !== expectedDivisionVersion) {
      throw new ConflictException(
        "Состав уже изменён в другой вкладке. Обновите данные."
      )
    }
    const invalid = preview.items.find((item) => item.status !== "READY")
    if (invalid) {
      throw new UnprocessableEntityException(
        `Нельзя добавить «${invalid.identifier}»: ${invalid.message ?? invalid.status}`
      )
    }
    const profiles = preview.items.map((item) => item.profile!)

    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const versionUpdate = await transaction.division.updateMany({
          where: { id: divisionId, version: expectedDivisionVersion },
          data: { version: { increment: 1 } },
        })
        if (versionUpdate.count !== 1) {
          throw new ConflictException(
            "Состав уже изменён в другой вкладке. Обновите данные."
          )
        }

        const division = await transaction.division.findUniqueOrThrow({
          where: { id: divisionId },
          select: { tournamentId: true, version: true },
        })
        const registrations: RegistrationRecord[] = []
        for (const profile of profiles) {
          const participant = await transaction.participant.upsert({
            where: { rankedUuid: profile.uuid },
            create: {
              rankedUuid: profile.uuid,
              currentNickname: profile.nickname,
              nicknameLower: profile.nickname.toLowerCase(),
              lastRankedSyncAt: new Date(),
              rankedProfileSnapshot: safeSnapshot(profile),
            },
            update: {
              currentNickname: profile.nickname,
              nicknameLower: profile.nickname.toLowerCase(),
              lastRankedSyncAt: new Date(),
              rankedProfileSnapshot: safeSnapshot(profile),
            },
          })
          registrations.push(
            await transaction.tournamentRegistration.create({
              data: {
                tournamentId: division.tournamentId,
                divisionId,
                participantId: participant.id,
                nicknameSnapshot: profile.nickname,
              },
              include: registrationInclude,
            })
          )
        }

        await this.audit.record(
          {
            adminUserId: context.adminUserId,
            action:
              registrations.length === 1
                ? "REGISTRATION_ADDED"
                : "REGISTRATIONS_BULK_ADDED",
            entityType: "Division",
            entityId: divisionId,
            requestId: context.requestId,
            after: {
              divisionVersion: division.version,
              registrations: registrations.map((registration) => ({
                id: registration.id,
                participantUuid: registration.participant.rankedUuid,
                nickname: registration.nicknameSnapshot,
              })),
            },
          },
          transaction
        )

        return {
          registrations: registrations.map((registration) =>
            this.mapRegistration(registration)
          ),
          divisionVersion: division.version,
        }
      })

      return { data: result }
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        throw new ConflictException(
          "Один из участников уже зарегистрирован в этом турнире."
        )
      }
      throw error
    }
  }

  async remove(
    registrationId: string,
    expectedRegistrationVersion: number,
    expectedDivisionVersion: number,
    context: AdminMutationContext
  ) {
    const registration = await this.prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        participant: { select: { rankedUuid: true } },
        division: { include: divisionScopeInclude },
      },
    })
    if (!registration) {
      throw new NotFoundException("Участник турнира не найден.")
    }
    this.assertRosterEditable(registration.division)
    if (
      registration.version !== expectedRegistrationVersion ||
      registration.division.version !== expectedDivisionVersion
    ) {
      throw new ConflictException(
        "Состав уже изменён в другой вкладке. Обновите данные."
      )
    }

    await this.prisma.$transaction(async (transaction) => {
      const divisionUpdate = await transaction.division.updateMany({
        where: {
          id: registration.divisionId,
          version: expectedDivisionVersion,
        },
        data: { version: { increment: 1 } },
      })
      const registrationDelete =
        await transaction.tournamentRegistration.deleteMany({
          where: { id: registrationId, version: expectedRegistrationVersion },
        })
      if (divisionUpdate.count !== 1 || registrationDelete.count !== 1) {
        throw new ConflictException(
          "Состав уже изменён в другой вкладке. Обновите данные."
        )
      }
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: "REGISTRATION_REMOVED",
          entityType: "TournamentRegistration",
          entityId: registrationId,
          requestId: context.requestId,
          before: {
            divisionId: registration.divisionId,
            participantUuid: registration.participant.rankedUuid,
            nickname: registration.nicknameSnapshot,
          },
        },
        transaction
      )
    })
  }

  async move(
    registrationId: string,
    input: MoveRegistrationDto,
    context: AdminMutationContext
  ): Promise<{ data: RegistrationMoveResult }> {
    const registration = await this.prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        participant: true,
        division: { include: divisionScopeInclude },
      },
    })
    if (!registration) {
      throw new NotFoundException("Участник турнира не найден.")
    }
    if (registration.divisionId === input.targetDivisionId) {
      throw new BadRequestException(
        "Участник уже находится в выбранном дивизионе."
      )
    }

    const targetDivision = await this.findDivision(input.targetDivisionId)
    if (targetDivision.tournamentId !== registration.tournamentId) {
      throw new BadRequestException(
        "Перемещать участника можно только внутри одного турнира."
      )
    }
    this.assertRosterEditable(registration.division)
    this.assertRosterEditable(targetDivision)
    if (
      registration.version !== input.expectedRegistrationVersion ||
      registration.division.version !== input.expectedSourceDivisionVersion ||
      targetDivision.version !== input.expectedTargetDivisionVersion
    ) {
      throw new ConflictException(
        "Состав уже изменён в другой вкладке. Обновите данные."
      )
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const sourceUpdate = await transaction.division.updateMany({
        where: {
          id: registration.divisionId,
          version: input.expectedSourceDivisionVersion,
        },
        data: { version: { increment: 1 } },
      })
      const targetUpdate = await transaction.division.updateMany({
        where: {
          id: targetDivision.id,
          version: input.expectedTargetDivisionVersion,
        },
        data: { version: { increment: 1 } },
      })
      const registrationUpdate =
        await transaction.tournamentRegistration.updateMany({
          where: {
            id: registrationId,
            version: input.expectedRegistrationVersion,
          },
          data: {
            divisionId: targetDivision.id,
            version: { increment: 1 },
          },
        })
      if (
        sourceUpdate.count !== 1 ||
        targetUpdate.count !== 1 ||
        registrationUpdate.count !== 1
      ) {
        throw new ConflictException(
          "Состав уже изменён в другой вкладке. Обновите данные."
        )
      }

      const updated =
        await transaction.tournamentRegistration.findUniqueOrThrow({
          where: { id: registrationId },
          include: registrationInclude,
        })
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: "REGISTRATION_MOVED",
          entityType: "TournamentRegistration",
          entityId: registrationId,
          requestId: context.requestId,
          before: {
            divisionId: registration.divisionId,
            nickname: registration.nicknameSnapshot,
          },
          after: {
            divisionId: targetDivision.id,
            nickname: updated.nicknameSnapshot,
          },
        },
        transaction
      )

      return {
        registration: this.mapRegistration(updated),
        sourceDivisionId: registration.divisionId,
        sourceDivisionVersion: registration.division.version + 1,
        targetDivisionId: targetDivision.id,
        targetDivisionVersion: targetDivision.version + 1,
      }
    })

    return { data: result }
  }

  private async findDivision(id: string) {
    const division = await this.prisma.division.findUnique({
      where: { id },
      include: divisionScopeInclude,
    })
    if (!division) {
      throw new NotFoundException("Дивизион не найден.")
    }
    return division
  }

  private assertRosterEditable(division: DivisionScope) {
    if (
      division.tournament.status === TournamentStatus.PLAYOFF ||
      division.tournament.status === TournamentStatus.COMPLETED
    ) {
      throw new BadRequestException(
        "На текущем этапе турнира состав изменять нельзя."
      )
    }
    if (this.isRosterLocked(division)) {
      throw new ConflictException(
        "Состав дивизиона зафиксирован после первого импорта матча."
      )
    }
  }

  private isRosterLocked(division: DivisionScope) {
    return division.qualificationMatches.length > 0
  }

  private previewItem(
    identifier: string,
    status: RegistrationPreviewItem["status"],
    profile: RankedUserProfile | null,
    registeredDivision: string | null,
    message: string | null
  ): RegistrationPreviewItem {
    return { identifier, status, profile, registeredDivision, message }
  }

  private mapRegistration(registration: RegistrationRecord): AdminRegistration {
    const snapshot =
      typeof registration.participant.rankedProfileSnapshot === "object" &&
      registration.participant.rankedProfileSnapshot !== null &&
      !Array.isArray(registration.participant.rankedProfileSnapshot)
        ? registration.participant.rankedProfileSnapshot
        : {}
    const numberOrNull = (value: unknown) =>
      typeof value === "number" ? value : null
    const roleType =
      typeof snapshot.roleType === "number" ? snapshot.roleType : 0
    const country =
      typeof snapshot.country === "string" ? snapshot.country : null

    return {
      id: registration.id,
      version: registration.version,
      nicknameSnapshot: registration.nicknameSnapshot,
      qualificationPoints: registration.qualificationPoints,
      playedMatches: registration.playedMatches,
      participant: {
        uuid: registration.participant.rankedUuid,
        nickname: registration.participant.currentNickname,
        roleType,
        eloRate: numberOrNull(snapshot.eloRate),
        eloRank: numberOrNull(snapshot.eloRank),
        country,
        avatarUrl: `https://mc-heads.net/avatar/${registration.participant.rankedUuid}/40`,
      },
    }
  }
}
