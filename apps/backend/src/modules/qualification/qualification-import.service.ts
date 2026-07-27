import { createHash } from "node:crypto"

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type {
  AdminQualificationMatch,
  QualificationCompletionLimit,
  QualificationImportApplied,
  QualificationImportHistoryEntry,
  QualificationImportPreview,
} from "@mcsr-sabinsk/shared"

import type { Prisma } from "../../generated/prisma/client.js"
import {
  ImportStatus,
  QualificationResultStatus,
  TournamentStatus,
} from "../../generated/prisma/enums.js"
import { AuditService } from "../audit/audit.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { RankedService } from "../ranked/ranked.service.js"
import type { CompletedQualificationCorrectionDto } from "./dto/completed-qualification-correction.dto.js"
import type { QualificationImportDto } from "./dto/qualification-import.dto.js"
import type { QualificationReimportDto } from "./dto/qualification-reimport.dto.js"
import { calculateQualificationMatch } from "./qualification-import.domain.js"
import {
  createQualificationPreviewToken,
  type QualificationPreviewTokenPayload,
  verifyQualificationPreviewToken,
} from "./qualification-preview-token.js"

const divisionImportInclude = {
  tournament: true,
  registrations: {
    include: { participant: true },
    orderBy: [{ nicknameSnapshot: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.DivisionInclude

type DivisionImportScope = Prisma.DivisionGetPayload<{
  include: typeof divisionImportInclude
}>

const adminMatchInclude = {
  winner: true,
  activeImport: {
    include: { results: true },
  },
} satisfies Prisma.QualificationMatchInclude

type AdminMatchRecord = Prisma.QualificationMatchGetPayload<{
  include: typeof adminMatchInclude
}>

interface MutationContext {
  adminUserId: string
  requestId: string
}

interface PreparedImport {
  calculation: ReturnType<typeof calculateQualificationMatch>
  rawPayload: Prisma.InputJsonValue
  payloadHash: string
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`
  }
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

@Injectable()
export class QualificationImportService {
  private readonly previewSecret: string

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RankedService) private readonly ranked: RankedService,
    @Inject(ConfigService) config: ConfigService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {
    this.previewSecret = config.getOrThrow<string>("CSRF_SECRET")
  }

  async list(divisionId: string) {
    await this.findDivision(divisionId)
    const matches = await this.prisma.qualificationMatch.findMany({
      where: { divisionId, activeImportId: { not: null } },
      include: adminMatchInclude,
      orderBy: { matchNumber: "asc" },
    })
    return { data: matches.map((match) => this.mapAdminMatch(match)) }
  }

  async previewNew(
    divisionId: string,
    rankedMatchId: string,
    completionLimit: QualificationCompletionLimit
  ) {
    const division = await this.findDivision(divisionId)
    this.assertNormalImportAllowed(division)
    const existing = await this.prisma.qualificationMatch.findUnique({
      where: { rankedMatchId },
      select: { id: true, divisionId: true },
    })
    if (existing) {
      throw new ConflictException(
        existing.divisionId === divisionId
          ? "Этот матч уже импортирован. Используйте повторный импорт."
          : "Этот Ranked-матч уже принадлежит другому дивизиону."
      )
    }

    const prepared = await this.prepare(
      division,
      rankedMatchId,
      completionLimit
    )
    return {
      data: this.createPreview(division, prepared, null, true),
    }
  }

  async importNew(
    divisionId: string,
    input: QualificationImportDto,
    context: MutationContext
  ) {
    const division = await this.findDivision(divisionId)
    this.assertNormalImportAllowed(division)
    if (division.version !== input.expectedDivisionVersion) {
      throw new ConflictException(
        "Дивизион уже изменён. Получите preview заново."
      )
    }
    const token = this.requireToken(input.previewToken, {
      divisionId,
      rankedMatchId: input.rankedMatchId,
      completionLimit: input.completionLimit,
      matchId: null,
    })
    const prepared = await this.prepare(
      division,
      input.rankedMatchId,
      input.completionLimit
    )
    this.assertFreshPreview(token, prepared.payloadHash)

    const duplicate = await this.prisma.qualificationMatch.findUnique({
      where: { rankedMatchId: input.rankedMatchId },
      select: { id: true },
    })
    if (duplicate) {
      throw new ConflictException("Этот Ranked-матч уже импортирован.")
    }

    const applied = await this.prisma.$transaction(async (transaction) => {
      const divisionUpdate = await transaction.division.updateMany({
        where: { id: divisionId, version: input.expectedDivisionVersion },
        data: { version: { increment: 1 } },
      })
      if (divisionUpdate.count !== 1) {
        throw new ConflictException(
          "Дивизион уже изменён. Получите preview заново."
        )
      }
      const lastMatch = await transaction.qualificationMatch.findFirst({
        where: { divisionId },
        select: { matchNumber: true },
        orderBy: { matchNumber: "desc" },
      })
      const match = await transaction.qualificationMatch.create({
        data: {
          divisionId,
          matchNumber: (lastMatch?.matchNumber ?? 0) + 1,
          rankedMatchId: input.rankedMatchId,
          completionLimit: input.completionLimit,
          rankedPlayedAt: prepared.calculation.playedAt,
          winnerRegistrationId: prepared.calculation.winnerRegistrationId,
        },
      })
      const imported = await this.createImportVersion(
        transaction,
        match.id,
        1,
        prepared,
        context.adminUserId,
        null
      )
      await transaction.qualificationMatch.update({
        where: { id: match.id },
        data: { activeImportId: imported.id },
      })
      await this.recalculateDivision(transaction, divisionId)
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: "QUALIFICATION_MATCH_IMPORTED",
          entityType: "QualificationMatch",
          entityId: match.id,
          requestId: context.requestId,
          after: {
            rankedMatchId: input.rankedMatchId,
            completionLimit: input.completionLimit,
            importVersion: 1,
            payloadHash: prepared.payloadHash,
          },
        },
        transaction
      )
      return {
        matchId: match.id,
        divisionVersion: input.expectedDivisionVersion + 1,
      }
    })

    return {
      data: {
        match: await this.getMappedMatch(applied.matchId),
        divisionVersion: applied.divisionVersion,
        changed: true,
      } satisfies QualificationImportApplied,
    }
  }

  async previewReimport(
    matchId: string,
    completionLimit: QualificationCompletionLimit
  ) {
    const match = await this.findMatchScope(matchId)
    const division = match.division
    if (
      division.tournament.status !== TournamentStatus.QUALIFICATION &&
      division.tournament.status !== TournamentStatus.COMPLETED
    ) {
      throw new BadRequestException(
        "Повторный импорт недоступен на текущем этапе турнира."
      )
    }
    const prepared = await this.prepare(
      division,
      match.rankedMatchId,
      completionLimit
    )
    const changed =
      prepared.payloadHash !== match.activeImport?.payloadHash ||
      match.completionLimit !== completionLimit
    return {
      data: this.createPreview(division, prepared, match.id, changed),
    }
  }

  async reimport(
    matchId: string,
    input: QualificationReimportDto,
    context: MutationContext
  ) {
    const match = await this.findMatchScope(matchId)
    if (match.division.tournament.status !== TournamentStatus.QUALIFICATION) {
      throw new BadRequestException(
        "Обычный повторный импорт разрешён только во время квалификации."
      )
    }
    return this.applyReimport(match, input, context, null)
  }

  async completedCorrection(
    matchId: string,
    input: CompletedQualificationCorrectionDto,
    context: MutationContext
  ) {
    if (!input.confirm) {
      throw new BadRequestException("Подтвердите корректировку истории.")
    }
    const match = await this.findMatchScope(matchId)
    if (match.division.tournament.status !== TournamentStatus.COMPLETED) {
      throw new BadRequestException(
        "Эта команда предназначена для завершённого турнира."
      )
    }
    return this.applyReimport(match, input, context, input.reason.trim())
  }

  async history(matchId: string) {
    const exists = await this.prisma.qualificationMatch.count({
      where: { id: matchId },
    })
    if (!exists) throw new NotFoundException("Матч не найден.")
    const imports = await this.prisma.qualificationMatchImport.findMany({
      where: { qualificationMatchId: matchId },
      orderBy: { importVersion: "desc" },
    })
    const data: QualificationImportHistoryEntry[] = imports.map((entry) => ({
      id: entry.id,
      importVersion: entry.importVersion,
      completionLimit:
        entry.completionLimit as QualificationCompletionLimit | null,
      status: entry.status,
      payloadHash: entry.payloadHash,
      rankedFetchedAt: entry.rankedFetchedAt.toISOString(),
      appliedAt: entry.appliedAt?.toISOString() ?? null,
      correctionReason: entry.correctionReason,
    }))
    return { data }
  }

  private async applyReimport(
    match: Awaited<ReturnType<QualificationImportService["findMatchScope"]>>,
    input: QualificationReimportDto,
    context: MutationContext,
    correctionReason: string | null
  ) {
    if (!match.activeImport) {
      throw new ConflictException("У матча нет активной версии импорта.")
    }
    const activeImport = match.activeImport
    if (match.version !== input.expectedMatchVersion) {
      throw new ConflictException("Матч уже изменён. Получите preview заново.")
    }
    const token = this.requireToken(input.previewToken, {
      divisionId: match.divisionId,
      rankedMatchId: match.rankedMatchId,
      matchId: match.id,
    })
    const prepared = await this.prepare(
      match.division,
      match.rankedMatchId,
      token.completionLimit
    )
    this.assertFreshPreview(token, prepared.payloadHash)
    const completionLimitChanged =
      match.completionLimit !== token.completionLimit
    if (
      prepared.payloadHash === activeImport.payloadHash &&
      !completionLimitChanged
    ) {
      return {
        data: {
          match: await this.getMappedMatch(match.id),
          divisionVersion: match.division.version,
          changed: false,
        } satisfies QualificationImportApplied,
      }
    }

    const applied = await this.prisma.$transaction(async (transaction) => {
      const matchUpdate = await transaction.qualificationMatch.updateMany({
        where: { id: match.id, version: input.expectedMatchVersion },
        data: {
          rankedPlayedAt: prepared.calculation.playedAt,
          completionLimit: token.completionLimit,
          winnerRegistrationId: prepared.calculation.winnerRegistrationId,
          version: { increment: 1 },
        },
      })
      if (matchUpdate.count !== 1) {
        throw new ConflictException(
          "Матч уже изменён. Получите preview заново."
        )
      }
      const importVersion = activeImport.importVersion + 1
      const imported = await this.createImportVersion(
        transaction,
        match.id,
        importVersion,
        prepared,
        context.adminUserId,
        correctionReason
      )
      await transaction.qualificationMatchImport.update({
        where: { id: activeImport.id },
        data: { status: ImportStatus.SUPERSEDED },
      })
      await transaction.qualificationMatch.update({
        where: { id: match.id },
        data: { activeImportId: imported.id },
      })
      const division = await transaction.division.update({
        where: { id: match.divisionId },
        data: { version: { increment: 1 } },
        select: { version: true },
      })
      await this.recalculateDivision(transaction, match.divisionId)
      await this.audit.record(
        {
          adminUserId: context.adminUserId,
          action: correctionReason
            ? "COMPLETED_QUALIFICATION_CORRECTED"
            : "QUALIFICATION_MATCH_REIMPORTED",
          entityType: "QualificationMatch",
          entityId: match.id,
          requestId: context.requestId,
          reason: correctionReason,
          before: {
            importVersion: activeImport.importVersion,
            payloadHash: activeImport.payloadHash,
            completionLimit: match.completionLimit,
          },
          after: {
            importVersion,
            payloadHash: prepared.payloadHash,
            completionLimit: token.completionLimit,
          },
        },
        transaction
      )
      return { divisionVersion: division.version }
    })

    return {
      data: {
        match: await this.getMappedMatch(match.id),
        divisionVersion: applied.divisionVersion,
        changed: true,
      } satisfies QualificationImportApplied,
    }
  }

  private async prepare(
    division: DivisionImportScope,
    rankedMatchId: string,
    completionLimit: QualificationCompletionLimit
  ): Promise<PreparedImport> {
    const fetched = await this.ranked.getMatch(rankedMatchId)
    if (!fetched) {
      throw new NotFoundException("Ranked-матч не найден.")
    }
    if (String(fetched.payload.id) !== rankedMatchId) {
      throw new BadRequestException(
        "Ranked API вернул матч с другим идентификатором."
      )
    }
    const calculation = calculateQualificationMatch(
      fetched.payload,
      division.registrations.map((registration) => ({
        id: registration.id,
        participantUuid: registration.participant.rankedUuid,
        nickname: registration.nicknameSnapshot,
      })),
      division.timeLimitMs,
      completionLimit
    )
    if (calculation.participantCount < 2) {
      throw new BadRequestException(
        "В матче участвовало меньше двух зарегистрированных игроков дивизиона."
      )
    }
    const rawPayload = toJsonValue(fetched.rawPayload)
    const payloadHash = createHash("sha256")
      .update(canonicalJson(rawPayload))
      .digest("hex")
    return { calculation, rawPayload, payloadHash }
  }

  private createPreview(
    division: DivisionImportScope,
    prepared: PreparedImport,
    matchId: string | null,
    changed: boolean
  ): QualificationImportPreview {
    return {
      rankedMatchId: prepared.calculation.rankedMatchId,
      completionLimit: prepared.calculation.completionLimit,
      playedAt: prepared.calculation.playedAt.toISOString(),
      payloadHash: prepared.payloadHash,
      previewToken: createQualificationPreviewToken(
        {
          divisionId: division.id,
          rankedMatchId: prepared.calculation.rankedMatchId,
          completionLimit: prepared.calculation.completionLimit,
          payloadHash: prepared.payloadHash,
          matchId,
          expiresAt: Date.now() + 10 * 60 * 1_000,
        },
        this.previewSecret
      ),
      participantCount: prepared.calculation.participantCount,
      winnerRegistrationId: prepared.calculation.winnerRegistrationId,
      results: prepared.calculation.results,
      ignoredPlayers: prepared.calculation.ignoredPlayers,
      warnings: prepared.calculation.warnings,
      changed,
    }
  }

  private async createImportVersion(
    transaction: Prisma.TransactionClient,
    matchId: string,
    importVersion: number,
    prepared: PreparedImport,
    adminUserId: string,
    correctionReason: string | null
  ) {
    const imported = await transaction.qualificationMatchImport.create({
      data: {
        qualificationMatchId: matchId,
        importVersion,
        completionLimit: prepared.calculation.completionLimit,
        status: ImportStatus.PENDING,
        rawPayload: prepared.rawPayload,
        payloadHash: prepared.payloadHash,
        rankedFetchedAt: new Date(),
        initiatedByAdminId: adminUserId,
        correctionReason,
      },
    })
    await transaction.qualificationResult.createMany({
      data: prepared.calculation.results.map((result) => ({
        qualificationMatchId: matchId,
        registrationId: result.registrationId,
        importId: imported.id,
        status: result.status,
        placement: result.placement,
        rawTimeMs: result.rawTimeMs,
        effectiveTimeMs: result.effectiveTimeMs,
        points: result.points,
        lastPhase: result.lastPhase,
        timeline: result.timeline as unknown as Prisma.InputJsonValue,
      })),
    })
    return transaction.qualificationMatchImport.update({
      where: { id: imported.id },
      data: {
        status: ImportStatus.APPLIED,
        appliedAt: new Date(),
      },
    })
  }

  private async recalculateDivision(
    transaction: Prisma.TransactionClient,
    divisionId: string
  ) {
    const registrations = await transaction.tournamentRegistration.findMany({
      where: { divisionId },
      include: {
        qualificationResults: {
          include: {
            qualificationMatch: {
              select: { activeImportId: true },
            },
          },
        },
      },
    })
    await Promise.all(
      registrations.map((registration) => {
        const active = registration.qualificationResults.filter(
          (result) =>
            result.importId === result.qualificationMatch.activeImportId
        )
        const effectiveTotal = active.reduce(
          (sum, result) => sum + result.effectiveTimeMs,
          0
        )
        return transaction.tournamentRegistration.update({
          where: { id: registration.id },
          data: {
            qualificationPoints: active.reduce(
              (sum, result) => sum + result.points,
              0
            ),
            averageTimeMs:
              active.length > 0
                ? Math.round(effectiveTotal / active.length)
                : null,
            playedMatches: active.filter(
              (result) => result.status !== QualificationResultStatus.MISSED
            ).length,
            dnfCount: active.filter(
              (result) => result.status === QualificationResultStatus.DNF
            ).length,
            missedCount: active.filter(
              (result) => result.status === QualificationResultStatus.MISSED
            ).length,
            version: { increment: 1 },
          },
        })
      })
    )
  }

  private async findDivision(id: string) {
    const division = await this.prisma.division.findUnique({
      where: { id },
      include: divisionImportInclude,
    })
    if (!division) throw new NotFoundException("Дивизион не найден.")
    return division
  }

  private async findMatchScope(id: string) {
    const match = await this.prisma.qualificationMatch.findUnique({
      where: { id },
      include: {
        activeImport: true,
        division: { include: divisionImportInclude },
      },
    })
    if (!match) throw new NotFoundException("Матч не найден.")
    return match
  }

  private assertNormalImportAllowed(division: DivisionImportScope) {
    if (division.tournament.status !== TournamentStatus.QUALIFICATION) {
      throw new ForbiddenException(
        "Импорт матчей разрешён только во время квалификации."
      )
    }
    if (!division.isParticipating) {
      throw new ForbiddenException(
        "Этот дивизион не участвует в текущем турнире."
      )
    }
    if (division.registrations.length < 2) {
      throw new BadRequestException(
        "Для импорта нужны минимум два участника дивизиона."
      )
    }
  }

  private requireToken(
    token: string,
    expected: {
      divisionId: string
      rankedMatchId: string
      completionLimit?: QualificationCompletionLimit
      matchId: string | null
    }
  ) {
    const payload = verifyQualificationPreviewToken(token, this.previewSecret)
    if (
      !payload ||
      payload.expiresAt < Date.now() ||
      payload.divisionId !== expected.divisionId ||
      payload.rankedMatchId !== expected.rankedMatchId ||
      (expected.completionLimit !== undefined &&
        payload.completionLimit !== expected.completionLimit) ||
      payload.matchId !== expected.matchId
    ) {
      throw new BadRequestException(
        "Preview устарел или недействителен. Получите его заново."
      )
    }
    return payload
  }

  private assertFreshPreview(
    token: QualificationPreviewTokenPayload,
    payloadHash: string
  ) {
    if (token.payloadHash !== payloadHash) {
      throw new ConflictException(
        "Данные Ranked изменились после preview. Проверьте их заново."
      )
    }
  }

  private async getMappedMatch(id: string) {
    const match = await this.prisma.qualificationMatch.findUniqueOrThrow({
      where: { id },
      include: adminMatchInclude,
    })
    return this.mapAdminMatch(match)
  }

  private mapAdminMatch(match: AdminMatchRecord): AdminQualificationMatch {
    const results = match.activeImport?.results ?? []
    return {
      id: match.id,
      matchNumber: match.matchNumber,
      rankedMatchId: match.rankedMatchId,
      completionLimit:
        match.completionLimit as QualificationCompletionLimit | null,
      playedAt: match.rankedPlayedAt?.toISOString() ?? null,
      winner: match.winner
        ? {
            registrationId: match.winner.id,
            nickname: match.winner.nicknameSnapshot,
          }
        : null,
      importVersion: match.activeImport?.importVersion ?? 0,
      version: match.version,
      payloadHash: match.activeImport?.payloadHash ?? "",
      resultCounts: {
        COMPLETED: results.filter(
          (result) => result.status === QualificationResultStatus.COMPLETED
        ).length,
        DNF: results.filter(
          (result) => result.status === QualificationResultStatus.DNF
        ).length,
        MISSED: results.filter(
          (result) => result.status === QualificationResultStatus.MISSED
        ).length,
      },
    }
  }
}
