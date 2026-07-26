import type {
  DivisionType,
  QualificationResultStatus,
  TournamentStatus,
} from "./enums.js"

export interface ApiEnvelope<T> {
  data: T
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
  lastPhase: string | null
  timeline: TimelineSegment[]
}

export interface QualificationMatchDetails {
  id: string
  matchNumber: number
  rankedMatchId: string
  results: QualificationMatchResult[]
}
