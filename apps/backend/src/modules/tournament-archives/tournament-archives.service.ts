import { createHash } from "node:crypto"

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type {
  TournamentArchiveImportResult,
  TournamentArchivePreview,
  TournamentArchivePreviewItem,
} from "@mcsr-sabinsk/shared"
import JSZip from "jszip"

import type { Prisma } from "../../generated/prisma/client.js"
import { AuditService } from "../audit/audit.service.js"
import { MediaService } from "../media/media.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import {
  tournamentArchiveDataSchema,
  tournamentArchiveManifestSchema,
  type TournamentArchiveBundle,
  type TournamentArchiveData,
} from "./tournament-archive.schema.js"

const ARCHIVE_FORMAT_VERSION = 1
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024
const MAX_DATA_BYTES = 75 * 1024 * 1024

interface ArchiveContext {
  adminUserId: string
  requestId: string
}

interface ParsedArchive {
  checksum: string
  exportedAt: string
  data: TournamentArchiveData
  covers: Map<string, Buffer>
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function archiveFileNamePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tournament"
  )
}

function coverExtension(mimeType: string, objectKey: string) {
  if (mimeType === "image/jpeg") return "jpg"
  if (mimeType === "image/png") return "png"
  if (mimeType === "image/webp") return "webp"
  const extension = objectKey.split(".").at(-1)?.toLowerCase()
  if (extension === "jpg" || extension === "jpeg") return "jpg"
  if (extension === "png" || extension === "webp") return extension
  throw new BadRequestException(
    "Формат одной из обложек не поддерживается архивом."
  )
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

@Injectable()
export class TournamentArchivesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async exportOne(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      select: { id: true, slug: true },
    })
    if (!tournament) {
      throw new NotFoundException("Турнир не найден.")
    }
    return {
      buffer: await this.buildArchive([id]),
      fileName: `mcsr-sabinsk-${archiveFileNamePart(tournament.slug)}.zip`,
    }
  }

  async exportAll() {
    const ids = await this.prisma.tournament.findMany({
      select: { id: true },
      orderBy: [{ startsAt: "asc" }, { name: "asc" }],
    })
    if (ids.length === 0) {
      throw new BadRequestException("Нет турниров для экспорта.")
    }
    const date = new Date().toISOString().slice(0, 10)
    return {
      buffer: await this.buildArchive(ids.map(({ id }) => id)),
      fileName: `mcsr-sabinsk-all-${date}.zip`,
    }
  }

  async preview(
    file: Express.Multer.File
  ): Promise<{ data: TournamentArchivePreview }> {
    const archive = await this.parseArchive(file)
    return { data: await this.buildPreview(archive, file.size) }
  }

  async import(
    file: Express.Multer.File,
    expectedChecksum: string,
    context: ArchiveContext
  ): Promise<{ data: TournamentArchiveImportResult }> {
    const archive = await this.parseArchive(file)
    if (archive.checksum !== expectedChecksum.toLowerCase()) {
      throw new ConflictException(
        "Файл изменился после предварительной проверки. Проверьте архив заново."
      )
    }
    const preview = await this.buildPreview(archive, file.size)
    const conflicts = preview.tournaments.filter(
      (item) => item.importStatus === "CONFLICT"
    )
    if (conflicts.length > 0) {
      throw new ConflictException(
        `Импорт остановлен: ${conflicts.map((item) => item.message).join("; ")}`
      )
    }

    const readyIds = new Set(
      preview.tournaments
        .filter((item) => item.importStatus === "READY")
        .map((item) => item.id)
    )
    const skippedTournamentIds = preview.tournaments
      .filter((item) => item.importStatus === "ALREADY_IMPORTED")
      .map((item) => item.id)
    if (readyIds.size === 0) {
      return {
        data: {
          importedTournamentIds: [],
          skippedTournamentIds,
          importedCount: 0,
          skippedCount: skippedTournamentIds.length,
        },
      }
    }

    const coverLocations = new Map<
      string,
      { objectKey: string; publicUrl: string }
    >()
    for (const bundle of archive.data.tournaments) {
      if (!readyIds.has(bundle.tournament.id) || !bundle.cover) continue
      const buffer = archive.covers.get(bundle.cover.path)
      if (!buffer) {
        throw new BadRequestException(
          `В архиве отсутствует обложка турнира «${bundle.tournament.name}».`
        )
      }
      coverLocations.set(
        bundle.tournament.id,
        await this.media.storeImportedCover({
          tournamentId: bundle.tournament.id,
          extension: bundle.cover.extension,
          mimeType: bundle.cover.mimeType,
          buffer,
        })
      )
    }

    let importedTournamentIds: string[]
    try {
      importedTournamentIds = await this.prisma.$transaction(
        async (transaction) => {
          const imported: string[] = []
          for (const bundle of archive.data.tournaments) {
            if (!readyIds.has(bundle.tournament.id)) continue
            await this.restoreBundle(
              transaction,
              bundle,
              coverLocations.get(bundle.tournament.id) ?? null,
              context
            )
            imported.push(bundle.tournament.id)
          }
          return imported
        },
        { timeout: 60_000 }
      )
    } catch (error) {
      await Promise.allSettled(
        [...coverLocations.values()].map(({ objectKey }) =>
          this.media.deleteImportedCover(objectKey)
        )
      )
      throw error
    }

    return {
      data: {
        importedTournamentIds,
        skippedTournamentIds,
        importedCount: importedTournamentIds.length,
        skippedCount: skippedTournamentIds.length,
      },
    }
  }

  private async buildArchive(tournamentIds: string[]) {
    const bundles = await this.prisma.$transaction(
      (transaction) =>
        Promise.all(
          tournamentIds.map((id) => this.exportBundle(transaction, id))
        ),
      { timeout: 60_000 }
    )
    const zip = new JSZip()

    for (const bundle of bundles) {
      if (!bundle.tournament.coverObjectKey) continue
      const cover = await this.media.downloadCover(
        bundle.tournament.coverObjectKey
      )
      const extension = coverExtension(
        cover.mimeType,
        bundle.tournament.coverObjectKey
      )
      const mimeType =
        extension === "jpg"
          ? ("image/jpeg" as const)
          : extension === "png"
            ? ("image/png" as const)
            : ("image/webp" as const)
      const path = `covers/${bundle.tournament.id}.${extension}`
      bundle.cover = {
        path,
        mimeType,
        extension,
        sha256: sha256(cover.buffer),
        sizeBytes: cover.buffer.length,
      }
      zip.file(path, cover.buffer)
    }

    const data = tournamentArchiveDataSchema.parse({ tournaments: bundles })
    const dataJson = JSON.stringify(data)
    const exportedAt = new Date().toISOString()
    const manifest = tournamentArchiveManifestSchema.parse({
      format: "mcsr-sabinsk-tournament-archive",
      version: ARCHIVE_FORMAT_VERSION,
      exportedAt,
      dataPath: "data.json",
      dataSha256: sha256(dataJson),
      tournamentCount: data.tournaments.length,
    })
    zip.file("manifest.json", JSON.stringify(manifest, null, 2))
    zip.file("data.json", dataJson)
    return zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })
  }

  private async exportBundle(
    transaction: Prisma.TransactionClient,
    tournamentId: string
  ): Promise<TournamentArchiveBundle> {
    const tournament = await transaction.tournament.findUnique({
      where: { id: tournamentId },
    })
    if (!tournament) {
      throw new NotFoundException("Один из экспортируемых турниров не найден.")
    }
    const divisions = await transaction.division.findMany({
      where: { tournamentId },
      orderBy: { sortOrder: "asc" },
    })
    const divisionIds = divisions.map(({ id }) => id)
    const registrations = await transaction.tournamentRegistration.findMany({
      where: { tournamentId },
    })
    const participants = await transaction.participant.findMany({
      where: {
        id: {
          in: [
            ...new Set(registrations.map(({ participantId }) => participantId)),
          ],
        },
      },
    })
    const qualificationMatches = await transaction.qualificationMatch.findMany({
      where: { divisionId: { in: divisionIds } },
      orderBy: [{ divisionId: "asc" }, { matchNumber: "asc" }],
    })
    const qualificationMatchIds = qualificationMatches.map(({ id }) => id)
    const qualificationImports =
      await transaction.qualificationMatchImport.findMany({
        where: { qualificationMatchId: { in: qualificationMatchIds } },
        orderBy: [{ qualificationMatchId: "asc" }, { importVersion: "asc" }],
      })
    const qualificationResults = await transaction.qualificationResult.findMany(
      {
        where: { qualificationMatchId: { in: qualificationMatchIds } },
      }
    )
    const playoffBrackets = await transaction.playoffBracket.findMany({
      where: { divisionId: { in: divisionIds } },
    })
    const bracketIds = playoffBrackets.map(({ id }) => id)
    const [playoffSeeds, playoffMatches] = await Promise.all([
      transaction.playoffSeed.findMany({
        where: { bracketId: { in: bracketIds } },
        orderBy: [{ bracketId: "asc" }, { seedNumber: "asc" }],
      }),
      transaction.playoffMatch.findMany({
        where: { bracketId: { in: bracketIds } },
        orderBy: [
          { bracketId: "asc" },
          { kind: "asc" },
          { roundNumber: "asc" },
          { position: "asc" },
        ],
      }),
    ])
    const entityIds = [
      tournament.id,
      ...divisionIds,
      ...registrations.map(({ id }) => id),
      ...qualificationMatchIds,
      ...qualificationImports.map(({ id }) => id),
      ...bracketIds,
      ...playoffSeeds.map(({ id }) => id),
      ...playoffMatches.map(({ id }) => id),
    ]
    const auditLogs = await transaction.auditLog.findMany({
      where: { entityId: { in: entityIds } },
      include: { adminUser: { select: { username: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })

    return tournamentArchiveDataSchema.shape.tournaments.element.parse({
      tournament: jsonClone(tournament),
      divisions: jsonClone(divisions),
      participants: jsonClone(participants),
      registrations: jsonClone(registrations),
      qualificationMatches: jsonClone(qualificationMatches),
      qualificationImports: jsonClone(qualificationImports),
      qualificationResults: jsonClone(qualificationResults),
      playoffBrackets: jsonClone(playoffBrackets),
      playoffSeeds: jsonClone(playoffSeeds),
      playoffMatches: jsonClone(playoffMatches),
      auditLogs: auditLogs.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before,
        after: entry.after,
        reason: entry.reason,
        requestId: entry.requestId,
        ipHash: entry.ipHash,
        createdAt: entry.createdAt.toISOString(),
        adminUsername: entry.actorUsernameSnapshot ?? entry.adminUser.username,
      })),
      cover: null,
    })
  }

  private async parseArchive(
    file: Express.Multer.File
  ): Promise<ParsedArchive> {
    if (!file?.buffer) {
      throw new BadRequestException("Выберите ZIP-архив.")
    }
    if (file.size > MAX_ARCHIVE_BYTES) {
      throw new BadRequestException("Размер архива превышает 100 МБ.")
    }

    let zip: JSZip
    try {
      zip = await JSZip.loadAsync(file.buffer, {
        checkCRC32: true,
        createFolders: false,
      })
    } catch {
      throw new BadRequestException("Не удалось прочитать ZIP-архив.")
    }
    const manifestEntry = zip.file("manifest.json")
    const dataEntry = zip.file("data.json")
    if (!manifestEntry || !dataEntry) {
      throw new BadRequestException(
        "В архиве отсутствуют manifest.json или data.json."
      )
    }

    try {
      const manifest = tournamentArchiveManifestSchema.parse(
        JSON.parse(await manifestEntry.async("string"))
      )
      const dataBuffer = await dataEntry.async("nodebuffer")
      if (dataBuffer.length > MAX_DATA_BYTES) {
        throw new BadRequestException(
          "Распакованные данные архива превышают 75 МБ."
        )
      }
      if (sha256(dataBuffer) !== manifest.dataSha256) {
        throw new BadRequestException(
          "Контрольная сумма данных архива не совпадает."
        )
      }
      const data = tournamentArchiveDataSchema.parse(
        JSON.parse(dataBuffer.toString("utf8"))
      )
      if (data.tournaments.length !== manifest.tournamentCount) {
        throw new BadRequestException(
          "Количество турниров не совпадает с манифестом."
        )
      }
      this.assertArchiveUniqueness(data)

      const covers = new Map<string, Buffer>()
      for (const bundle of data.tournaments) {
        if (!bundle.cover) continue
        if (
          !bundle.cover.path.startsWith("covers/") ||
          bundle.cover.path.includes("..")
        ) {
          throw new BadRequestException("Недопустимый путь обложки в архиве.")
        }
        const coverEntry = zip.file(bundle.cover.path)
        if (!coverEntry) {
          throw new BadRequestException(
            `Не найдена обложка турнира «${bundle.tournament.name}».`
          )
        }
        const cover = await coverEntry.async("nodebuffer")
        if (
          cover.length !== bundle.cover.sizeBytes ||
          sha256(cover) !== bundle.cover.sha256
        ) {
          throw new BadRequestException(
            `Повреждена обложка турнира «${bundle.tournament.name}».`
          )
        }
        covers.set(bundle.cover.path, cover)
      }
      return {
        checksum: sha256(file.buffer),
        exportedAt: manifest.exportedAt,
        data,
        covers,
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      throw new BadRequestException(
        "Архив имеет неподдерживаемую или повреждённую структуру."
      )
    }
  }

  private assertArchiveUniqueness(data: TournamentArchiveData) {
    const tournamentIds = new Set<string>()
    const slugs = new Set<string>()
    const rankedMatchIds = new Set<string>()
    for (const bundle of data.tournaments) {
      if (
        tournamentIds.has(bundle.tournament.id) ||
        slugs.has(bundle.tournament.slug)
      ) {
        throw new BadRequestException(
          "Архив содержит повторяющиеся турниры или slug."
        )
      }
      tournamentIds.add(bundle.tournament.id)
      slugs.add(bundle.tournament.slug)
      for (const match of bundle.qualificationMatches) {
        if (rankedMatchIds.has(match.rankedMatchId)) {
          throw new BadRequestException(
            "Архив содержит повторяющийся Ranked match ID."
          )
        }
        rankedMatchIds.add(match.rankedMatchId)
      }
    }
  }

  private async buildPreview(
    archive: ParsedArchive,
    fileSizeBytes: number
  ): Promise<TournamentArchivePreview> {
    const tournaments: TournamentArchivePreviewItem[] = []
    for (const bundle of archive.data.tournaments) {
      tournaments.push(await this.previewBundle(bundle))
    }
    const participantUuids = new Set(
      archive.data.tournaments.flatMap((bundle) =>
        bundle.participants.map(({ rankedUuid }) => rankedUuid)
      )
    )
    const counts = {
      tournaments: archive.data.tournaments.length,
      participants: participantUuids.size,
      qualificationMatches: archive.data.tournaments.reduce(
        (sum, bundle) => sum + bundle.qualificationMatches.length,
        0
      ),
      playoffBrackets: archive.data.tournaments.reduce(
        (sum, bundle) => sum + bundle.playoffBrackets.length,
        0
      ),
      covers: archive.covers.size,
      auditEntries: archive.data.tournaments.reduce(
        (sum, bundle) => sum + bundle.auditLogs.length,
        0
      ),
    }
    return {
      archiveVersion: ARCHIVE_FORMAT_VERSION,
      archiveChecksum: archive.checksum,
      exportedAt: archive.exportedAt,
      fileSizeBytes,
      counts,
      tournaments,
      canImport:
        tournaments.some((item) => item.importStatus === "READY") &&
        tournaments.every((item) => item.importStatus !== "CONFLICT"),
    }
  }

  private async previewBundle(
    bundle: TournamentArchiveBundle
  ): Promise<TournamentArchivePreviewItem> {
    const existingById = await this.prisma.tournament.findUnique({
      where: { id: bundle.tournament.id },
      select: { id: true },
    })
    if (existingById) {
      return this.previewItem(
        bundle,
        "ALREADY_IMPORTED",
        "Турнир уже импортирован."
      )
    }
    const existingSlug = await this.prisma.tournament.findUnique({
      where: { slug: bundle.tournament.slug },
      select: { id: true },
    })
    if (existingSlug) {
      return this.previewItem(
        bundle,
        "CONFLICT",
        `Slug «${bundle.tournament.slug}» уже используется другим турниром.`
      )
    }
    const rankedMatchIds = bundle.qualificationMatches.map(
      ({ rankedMatchId }) => rankedMatchId
    )
    const existingMatch =
      rankedMatchIds.length === 0
        ? null
        : await this.prisma.qualificationMatch.findFirst({
            where: { rankedMatchId: { in: rankedMatchIds } },
            select: { rankedMatchId: true },
          })
    if (existingMatch) {
      return this.previewItem(
        bundle,
        "CONFLICT",
        `Ranked #${existingMatch.rankedMatchId} уже относится к другому турниру.`
      )
    }
    const entityConflict = await this.findEntityIdConflict(bundle)
    if (entityConflict) {
      return this.previewItem(bundle, "CONFLICT", entityConflict)
    }
    return this.previewItem(bundle, "READY", null)
  }

  private previewItem(
    bundle: TournamentArchiveBundle,
    importStatus: TournamentArchivePreviewItem["importStatus"],
    message: string | null
  ): TournamentArchivePreviewItem {
    return {
      id: bundle.tournament.id,
      name: bundle.tournament.name,
      slug: bundle.tournament.slug,
      status: bundle.tournament.status,
      importStatus,
      message,
    }
  }

  private async findEntityIdConflict(bundle: TournamentArchiveBundle) {
    const checks = [
      this.prisma.division.count({
        where: { id: { in: bundle.divisions.map(({ id }) => id) } },
      }),
      this.prisma.tournamentRegistration.count({
        where: { id: { in: bundle.registrations.map(({ id }) => id) } },
      }),
      this.prisma.qualificationMatch.count({
        where: {
          id: { in: bundle.qualificationMatches.map(({ id }) => id) },
        },
      }),
      this.prisma.qualificationMatchImport.count({
        where: {
          id: { in: bundle.qualificationImports.map(({ id }) => id) },
        },
      }),
      this.prisma.qualificationResult.count({
        where: {
          id: { in: bundle.qualificationResults.map(({ id }) => id) },
        },
      }),
      this.prisma.playoffBracket.count({
        where: { id: { in: bundle.playoffBrackets.map(({ id }) => id) } },
      }),
      this.prisma.playoffSeed.count({
        where: { id: { in: bundle.playoffSeeds.map(({ id }) => id) } },
      }),
      this.prisma.playoffMatch.count({
        where: { id: { in: bundle.playoffMatches.map(({ id }) => id) } },
      }),
      this.prisma.auditLog.count({
        where: { id: { in: bundle.auditLogs.map(({ id }) => id) } },
      }),
    ]
    const counts = await this.prisma.$transaction(checks)
    if (counts.some((count) => count > 0)) {
      return `Внутренние ID турнира «${bundle.tournament.name}» пересекаются с существующими данными.`
    }
    for (const participant of bundle.participants) {
      const existing = await this.prisma.participant.findUnique({
        where: { id: participant.id },
        select: { rankedUuid: true },
      })
      if (existing && existing.rankedUuid !== participant.rankedUuid) {
        return `ID участника ${participant.id} уже принадлежит другому Ranked UUID.`
      }
    }
    return null
  }

  private async restoreBundle(
    transaction: Prisma.TransactionClient,
    bundle: TournamentArchiveBundle,
    cover: { objectKey: string; publicUrl: string } | null,
    context: ArchiveContext
  ) {
    const participantIdMap = new Map<string, string>()
    for (const participant of bundle.participants) {
      const existing = await transaction.participant.findUnique({
        where: { rankedUuid: participant.rankedUuid },
      })
      if (existing) {
        participantIdMap.set(participant.id, existing.id)
        continue
      }
      await transaction.participant.create({
        data: {
          ...participant,
          lastRankedSyncAt: new Date(participant.lastRankedSyncAt),
          rankedProfileSnapshot: inputJson(participant.rankedProfileSnapshot),
        },
      })
      participantIdMap.set(participant.id, participant.id)
    }

    await transaction.tournament.create({
      data: {
        ...bundle.tournament,
        startsAt: new Date(bundle.tournament.startsAt),
        endsAt: new Date(bundle.tournament.endsAt),
        completedAt: bundle.tournament.completedAt
          ? new Date(bundle.tournament.completedAt)
          : null,
        coverObjectKey: cover?.objectKey ?? null,
        coverUrl: cover?.publicUrl ?? null,
      },
    })
    await transaction.division.createMany({ data: bundle.divisions })
    await transaction.tournamentRegistration.createMany({
      data: bundle.registrations.map((registration) => ({
        ...registration,
        participantId:
          participantIdMap.get(registration.participantId) ??
          registration.participantId,
      })),
    })
    await transaction.qualificationMatch.createMany({
      data: bundle.qualificationMatches.map((match) => ({
        ...match,
        rankedPlayedAt: match.rankedPlayedAt
          ? new Date(match.rankedPlayedAt)
          : null,
        activeImportId: null,
      })),
    })
    await transaction.qualificationMatchImport.createMany({
      data: bundle.qualificationImports.map((matchImport) => ({
        ...matchImport,
        rawPayload: inputJson(matchImport.rawPayload),
        rankedFetchedAt: new Date(matchImport.rankedFetchedAt),
        appliedAt: matchImport.appliedAt
          ? new Date(matchImport.appliedAt)
          : null,
        initiatedByAdminId: context.adminUserId,
      })),
    })
    await transaction.qualificationResult.createMany({
      data: bundle.qualificationResults.map((result) => ({
        ...result,
        timeline: inputJson(result.timeline),
      })),
    })
    for (const match of bundle.qualificationMatches) {
      if (!match.activeImportId) continue
      await transaction.qualificationMatch.update({
        where: { id: match.id },
        data: { activeImportId: match.activeImportId },
      })
    }
    await transaction.playoffBracket.createMany({
      data: bundle.playoffBrackets,
    })
    await transaction.playoffSeed.createMany({ data: bundle.playoffSeeds })
    await transaction.playoffMatch.createMany({ data: bundle.playoffMatches })

    for (const entry of bundle.auditLogs) {
      await transaction.auditLog.create({
        data: {
          id: entry.id,
          adminUserId: context.adminUserId,
          actorUsernameSnapshot: entry.adminUsername,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          ...(entry.before === null ? {} : { before: inputJson(entry.before) }),
          ...(entry.after === null ? {} : { after: inputJson(entry.after) }),
          reason: entry.reason,
          requestId: entry.requestId,
          ipHash: entry.ipHash,
          createdAt: new Date(entry.createdAt),
        },
      })
    }
    await this.audit.record(
      {
        adminUserId: context.adminUserId,
        action: "TOURNAMENT_ARCHIVE_IMPORTED",
        entityType: "Tournament",
        entityId: bundle.tournament.id,
        requestId: context.requestId,
        after: {
          archiveVersion: ARCHIVE_FORMAT_VERSION,
          tournamentName: bundle.tournament.name,
        },
      },
      transaction
    )
  }
}
