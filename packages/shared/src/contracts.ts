import type {
  DivisionType,
  QualificationResultStatus,
  TournamentStatus,
} from "./enums.js"

export interface ApiEnvelope<T> {
  data: T
}

export interface AdminIdentity {
  id: string
  username: string
}

export interface AdminSession {
  admin: AdminIdentity
  expiresAt: string
  csrfToken: string
}

export interface AdminAuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  reason: string | null
  createdAt: string
  adminUsername: string
}

export interface AdminOverview {
  tournamentCount: number
  activeTournamentCount: number
  draftTournamentCount: number
  recentAudit: AdminAuditEntry[]
}

export interface AdminDivision {
  id: string
  type: DivisionType
  displayName: string
  timeLimitMs: number
  isParticipating: boolean
  version: number
  registrationCount: number
  qualificationMatchCount: number
  rosterLocked: boolean
}

export interface AdminTournament {
  id: string
  name: string
  slug: string
  description: string
  startsAt: string
  endsAt: string
  status: TournamentStatus
  coverObjectKey: string | null
  coverUrl: string | null
  version: number
  completedAt: string | null
  divisions: AdminDivision[]
}

export interface CoverUpload {
  objectKey: string
  publicUrl: string
}

export interface RankedUserProfile {
  uuid: string
  nickname: string
  roleType: number
  eloRate: number | null
  eloRank: number | null
  country: string | null
  avatarUrl: string
}

export interface AdminRegistration {
  id: string
  version: number
  nicknameSnapshot: string
  qualificationPoints: number
  playedMatches: number
  participant: RankedUserProfile
}

export type RegistrationPreviewStatus =
  | "READY"
  | "ALREADY_REGISTERED"
  | "CONFLICT"
  | "DUPLICATE_INPUT"
  | "NOT_FOUND"
  | "ERROR"

export interface RegistrationPreviewItem {
  identifier: string
  status: RegistrationPreviewStatus
  profile: RankedUserProfile | null
  registeredDivision: string | null
  message: string | null
}

export interface RegistrationPreview {
  divisionId: string
  divisionVersion: number
  rosterLocked: boolean
  items: RegistrationPreviewItem[]
  readyCount: number
}

export interface RegistrationMutationResult {
  registrations: AdminRegistration[]
  divisionVersion: number
}

export interface RegistrationMoveResult {
  registration: AdminRegistration
  sourceDivisionId: string
  sourceDivisionVersion: number
  targetDivisionId: string
  targetDivisionVersion: number
}

export interface PublicDivision {
  id: string
  type: DivisionType
  displayName: string
  timeLimitMs: number
  hasPublishedPlayoff: boolean
}

export interface PublicTournament {
  id: string
  name: string
  slug: string
  description: string
  startsAt: string
  endsAt: string
  status: Exclude<TournamentStatus, "DRAFT">
  coverUrl: string | null
  divisions: PublicDivision[]
}

export interface Standing {
  rank: number
  registrationId: string
  participantUuid: string
  nickname: string
  points: number
  averageTimeMs: number | null
  playedMatches: number
  dnfCount: number
  missedCount: number
}

export interface StandingsResponse {
  division: Pick<PublicDivision, "type" | "displayName" | "timeLimitMs">
  standings: Standing[]
}

export interface QualificationMatchSummary {
  id: string
  matchNumber: number
  rankedMatchId: string
  playedAt: string | null
  winner: {
    registrationId: string
    nickname: string
  } | null
  importVersion: number
}

export interface ParticipantMatchResult {
  matchId: string
  matchNumber: number
  status: QualificationResultStatus
  placement: number | null
  timeMs: number | null
  points: number
}

export interface ParticipantQualification {
  rank: number
  nickname: string
  participantUuid: string
  points: number
  averageTimeMs: number | null
  matches: ParticipantMatchResult[]
}

export interface TimelineSegment {
  phase: string
  startMs: number
  endMs: number
}

export interface QualificationMatchResult {
  registrationId: string
  participantUuid: string
  nickname: string
  avatarUrl: string
  status: QualificationResultStatus
  placement: number | null
  timeMs: number | null
  effectiveTimeMs: number
  lastPhase: string | null
  timeline: TimelineSegment[]
}

export interface QualificationMatchDetails {
  id: string
  matchNumber: number
  rankedMatchId: string
  timeLimitMs: number
  results: QualificationMatchResult[]
}

export interface QualificationImportPreviewResult {
  registrationId: string
  participantUuid: string
  nickname: string
  status: QualificationResultStatus
  placement: number | null
  rawTimeMs: number | null
  effectiveTimeMs: number
  points: number
  lastPhase: string | null
  timeline: TimelineSegment[]
}

export interface QualificationIgnoredPlayer {
  participantUuid: string
  nickname: string
}

export interface QualificationImportPreview {
  rankedMatchId: string
  playedAt: string
  payloadHash: string
  previewToken: string
  participantCount: number
  winnerRegistrationId: string | null
  results: QualificationImportPreviewResult[]
  ignoredPlayers: QualificationIgnoredPlayer[]
  warnings: string[]
  changed: boolean
}

export interface AdminQualificationMatch extends QualificationMatchSummary {
  version: number
  payloadHash: string
  resultCounts: Record<QualificationResultStatus, number>
}

export interface QualificationImportApplied {
  match: AdminQualificationMatch
  divisionVersion: number
  changed: boolean
}

export interface QualificationImportHistoryEntry {
  id: string
  importVersion: number
  status: "PENDING" | "APPLIED" | "FAILED" | "SUPERSEDED"
  payloadHash: string
  rankedFetchedAt: string
  appliedAt: string | null
  correctionReason: string | null
}

export type PlayoffMatchKind = "MAIN" | "THIRD_PLACE"
export type PlayoffMatchStatus = "EMPTY" | "READY" | "COMPLETED"

export interface PlayoffParticipant {
  registrationId: string
  nickname: string
}

export interface PlayoffMatch {
  id: string
  kind: PlayoffMatchKind
  roundNumber: number
  position: number
  participant1: PlayoffParticipant | null
  participant2: PlayoffParticipant | null
  score1: number | null
  score2: number | null
  winnerRegistrationId: string | null
  status: PlayoffMatchStatus
  version: number
}

export interface PlayoffRound {
  roundNumber: number
  name: string
  matches: PlayoffMatch[]
}

export interface PublicPlayoff {
  size: 4 | 8 | 16
  showThirdPlace: boolean
  rounds: PlayoffRound[]
  thirdPlaceMatch: PlayoffMatch | null
}

export interface AdminPlayoffRegistration extends PlayoffParticipant {
  qualificationPoints: number
  averageTimeMs: number | null
}

export interface AdminPlayoffSeed {
  seedNumber: number
  registrationId: string | null
}

export interface AdminPlayoff extends PublicPlayoff {
  id: string
  divisionId: string
  divisionDisplayName: string
  isPublished: boolean
  version: number
  registrations: AdminPlayoffRegistration[]
  seeds: AdminPlayoffSeed[]
  warnings: string[]
}
