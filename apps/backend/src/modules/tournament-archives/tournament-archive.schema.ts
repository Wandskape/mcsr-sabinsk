import { z } from "zod"

const uuid = z.string().uuid()
const dateTime = z.string().datetime({ offset: true })
const nullableJson = z.unknown().nullable()

const tournamentSchema = z.object({
  id: uuid,
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  startsAt: dateTime,
  endsAt: dateTime,
  status: z.enum([
    "DRAFT",
    "UPCOMING",
    "QUALIFICATION",
    "PLAYOFF",
    "COMPLETED",
  ]),
  coverObjectKey: z.string().nullable(),
  coverUrl: z.string().nullable(),
  version: z.number().int().positive(),
  completedAt: dateTime.nullable(),
})

const divisionSchema = z.object({
  id: uuid,
  tournamentId: uuid,
  type: z.enum(["BEGINNER", "EXPERIENCED", "PRO"]),
  displayName: z.string(),
  timeLimitMs: z.number().int().positive(),
  sortOrder: z.number().int(),
  isParticipating: z.boolean(),
  version: z.number().int().positive(),
})

const participantSchema = z.object({
  id: uuid,
  rankedUuid: z.string().length(32),
  currentNickname: z.string(),
  nicknameLower: z.string(),
  lastRankedSyncAt: dateTime,
  rankedProfileSnapshot: z.unknown(),
})

const registrationSchema = z.object({
  id: uuid,
  tournamentId: uuid,
  divisionId: uuid,
  participantId: uuid,
  nicknameSnapshot: z.string(),
  qualificationPoints: z.number().int(),
  averageTimeMs: z.number().int().nullable(),
  playedMatches: z.number().int().nonnegative(),
  dnfCount: z.number().int().nonnegative(),
  missedCount: z.number().int().nonnegative(),
  version: z.number().int().positive(),
})

const qualificationMatchSchema = z.object({
  id: uuid,
  divisionId: uuid,
  matchNumber: z.number().int().positive(),
  rankedMatchId: z.string(),
  completionLimit: z.number().int().positive().nullable(),
  rankedPlayedAt: dateTime.nullable(),
  winnerRegistrationId: uuid.nullable(),
  activeImportId: uuid.nullable(),
  version: z.number().int().positive(),
})

const qualificationImportSchema = z.object({
  id: uuid,
  qualificationMatchId: uuid,
  importVersion: z.number().int().positive(),
  completionLimit: z.number().int().positive().nullable(),
  seedType: z.string().nullable(),
  bastionType: z.string().nullable(),
  status: z.enum(["PENDING", "APPLIED", "FAILED", "SUPERSEDED"]),
  rawPayload: z.unknown(),
  payloadHash: z.string().length(64),
  rankedFetchedAt: dateTime,
  initiatedByAdminId: uuid,
  correctionReason: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  appliedAt: dateTime.nullable(),
})

const qualificationResultSchema = z.object({
  id: uuid,
  qualificationMatchId: uuid,
  registrationId: uuid,
  importId: uuid,
  status: z.enum(["COMPLETED", "DNF", "MISSED"]),
  placement: z.number().int().positive().nullable(),
  rawTimeMs: z.number().int().nonnegative().nullable(),
  effectiveTimeMs: z.number().int().nonnegative(),
  points: z.number().int().nonnegative(),
  lastPhase: z.string().nullable(),
  timeline: z.unknown(),
})

const playoffBracketSchema = z.object({
  id: uuid,
  divisionId: uuid,
  size: z.number().int(),
  showThirdPlace: z.boolean(),
  isPublished: z.boolean(),
  version: z.number().int().positive(),
})

const playoffSeedSchema = z.object({
  id: uuid,
  bracketId: uuid,
  seedNumber: z.number().int().positive(),
  registrationId: uuid.nullable(),
})

const playoffMatchSchema = z.object({
  id: uuid,
  bracketId: uuid,
  kind: z.enum(["MAIN", "THIRD_PLACE"]),
  roundNumber: z.number().int().positive(),
  position: z.number().int().positive(),
  participant1RegistrationId: uuid.nullable(),
  participant2RegistrationId: uuid.nullable(),
  score1: z.number().int().nonnegative().nullable(),
  score2: z.number().int().nonnegative().nullable(),
  winnerRegistrationId: uuid.nullable(),
  status: z.enum(["EMPTY", "READY", "COMPLETED"]),
  version: z.number().int().positive(),
})

const auditLogSchema = z.object({
  id: uuid,
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  before: nullableJson,
  after: nullableJson,
  reason: z.string().nullable(),
  requestId: z.string(),
  ipHash: z.string().nullable(),
  createdAt: dateTime,
  adminUsername: z.string(),
})

const coverSchema = z
  .object({
    path: z.string(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    extension: z.enum(["jpg", "jpeg", "png", "webp"]),
    sha256: z.string().length(64),
    sizeBytes: z.number().int().nonnegative(),
  })
  .nullable()

export const tournamentArchiveBundleSchema = z.object({
  tournament: tournamentSchema,
  divisions: z.array(divisionSchema),
  participants: z.array(participantSchema),
  registrations: z.array(registrationSchema),
  qualificationMatches: z.array(qualificationMatchSchema),
  qualificationImports: z.array(qualificationImportSchema),
  qualificationResults: z.array(qualificationResultSchema),
  playoffBrackets: z.array(playoffBracketSchema),
  playoffSeeds: z.array(playoffSeedSchema),
  playoffMatches: z.array(playoffMatchSchema),
  auditLogs: z.array(auditLogSchema),
  cover: coverSchema,
})

export const tournamentArchiveDataSchema = z.object({
  tournaments: z.array(tournamentArchiveBundleSchema).min(1),
})

export const tournamentArchiveManifestSchema = z.object({
  format: z.literal("mcsr-sabinsk-tournament-archive"),
  version: z.literal(1),
  exportedAt: dateTime,
  dataPath: z.literal("data.json"),
  dataSha256: z.string().length(64),
  tournamentCount: z.number().int().positive(),
})

export type TournamentArchiveData = z.infer<typeof tournamentArchiveDataSchema>
export type TournamentArchiveBundle = z.infer<
  typeof tournamentArchiveBundleSchema
>
export type TournamentArchiveManifest = z.infer<
  typeof tournamentArchiveManifestSchema
>
