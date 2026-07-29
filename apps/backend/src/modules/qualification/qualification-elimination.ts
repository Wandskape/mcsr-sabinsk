import type {
  DivisionType,
  QualificationResultStatus,
} from "@mcsr-sabinsk/shared"

export interface QualificationEliminationRegistration {
  id: string
  nickname: string
}

export interface QualificationEliminationResult {
  registrationId: string
  points: number
  effectiveTimeMs: number
  status: QualificationResultStatus
}

export interface QualificationEliminationMatch {
  matchNumber: number
  results: QualificationEliminationResult[]
}

export interface QualificationComputedStanding {
  registrationId: string
  nickname: string
  points: number
  averageTimeMs: number | null
  playedMatches: number
  dnfCount: number
  missedCount: number
  eliminated: boolean
  eliminatedAfterMatch: number | null
}

type EliminationRule =
  | { matchNumber: number; kind: "ZERO_POINTS" }
  | { matchNumber: number; kind: "TOP"; keep: number }

const BEGINNER_RULES: EliminationRule[] = [
  { matchNumber: 3, kind: "ZERO_POINTS" },
  { matchNumber: 4, kind: "TOP", keep: 8 },
  { matchNumber: 5, kind: "TOP", keep: 4 },
]

const ADVANCED_RULES: EliminationRule[] = [
  { matchNumber: 3, kind: "ZERO_POINTS" },
  { matchNumber: 5, kind: "TOP", keep: 8 },
  { matchNumber: 7, kind: "TOP", keep: 6 },
  { matchNumber: 8, kind: "TOP", keep: 4 },
]

interface MutableStanding {
  registrationId: string
  nickname: string
  points: number
  effectiveTimeTotalMs: number
  countedMatches: number
  playedMatches: number
  dnfCount: number
  missedCount: number
  eliminatedAfterMatch: number | null
}

export function calculateQualificationStandings(input: {
  divisionType: DivisionType
  timeLimitMs: number
  registrations: QualificationEliminationRegistration[]
  matches: QualificationEliminationMatch[]
}): QualificationComputedStanding[] {
  const standings = new Map<string, MutableStanding>(
    input.registrations.map((registration) => [
      registration.id,
      {
        registrationId: registration.id,
        nickname: registration.nickname,
        points: 0,
        effectiveTimeTotalMs: 0,
        countedMatches: 0,
        playedMatches: 0,
        dnfCount: 0,
        missedCount: 0,
        eliminatedAfterMatch: null,
      },
    ])
  )
  const rules = eliminationRules(input.divisionType)
  const rulesByMatch = new Map(rules.map((rule) => [rule.matchNumber, rule]))
  const matches = [...input.matches].sort(
    (left, right) => left.matchNumber - right.matchNumber
  )

  for (const match of matches) {
    const resultByRegistrationId = new Map(
      match.results.map((result) => [result.registrationId, result])
    )
    const active = [...standings.values()].filter(
      (standing) => standing.eliminatedAfterMatch === null
    )

    for (const standing of active) {
      const result = resultByRegistrationId.get(standing.registrationId)
      standing.countedMatches += 1
      if (!result) {
        standing.effectiveTimeTotalMs += input.timeLimitMs
        standing.missedCount += 1
        continue
      }

      standing.points += result.points
      standing.effectiveTimeTotalMs += result.effectiveTimeMs
      if (result.status !== "MISSED") standing.playedMatches += 1
      if (result.status === "DNF") standing.dnfCount += 1
      if (result.status === "MISSED") standing.missedCount += 1
    }

    const rule = rulesByMatch.get(match.matchNumber)
    if (!rule) continue

    const rankedActive = sortMutableStandings(
      [...standings.values()].filter(
        (standing) => standing.eliminatedAfterMatch === null
      )
    )
    const eliminated =
      rule.kind === "ZERO_POINTS"
        ? rankedActive.filter((standing) => standing.points === 0)
        : rankedActive.slice(rule.keep)

    for (const standing of eliminated) {
      standing.eliminatedAfterMatch = match.matchNumber
    }
  }

  const ordered = [...standings.values()].sort((left, right) => {
    const leftEliminated = left.eliminatedAfterMatch !== null
    const rightEliminated = right.eliminatedAfterMatch !== null
    if (leftEliminated !== rightEliminated) return leftEliminated ? 1 : -1
    return compareMutableStandings(left, right)
  })

  return ordered.map((standing) => ({
    registrationId: standing.registrationId,
    nickname: standing.nickname,
    points: standing.points,
    averageTimeMs:
      standing.countedMatches > 0
        ? Math.round(standing.effectiveTimeTotalMs / standing.countedMatches)
        : null,
    playedMatches: standing.playedMatches,
    dnfCount: standing.dnfCount,
    missedCount: standing.missedCount,
    eliminated: standing.eliminatedAfterMatch !== null,
    eliminatedAfterMatch: standing.eliminatedAfterMatch,
  }))
}

export function eligibleRegistrationIdsBeforeMatch(input: {
  divisionType: DivisionType
  timeLimitMs: number
  registrations: QualificationEliminationRegistration[]
  matches: QualificationEliminationMatch[]
  matchNumber: number
}): Set<string> {
  return new Set(
    calculateQualificationStandings({
      divisionType: input.divisionType,
      timeLimitMs: input.timeLimitMs,
      registrations: input.registrations,
      matches: input.matches.filter(
        (match) => match.matchNumber < input.matchNumber
      ),
    })
      .filter((standing) => !standing.eliminated)
      .map((standing) => standing.registrationId)
  )
}

function eliminationRules(divisionType: DivisionType) {
  return divisionType === "BEGINNER" ? BEGINNER_RULES : ADVANCED_RULES
}

function sortMutableStandings(standings: MutableStanding[]) {
  return standings.sort(compareMutableStandings)
}

function compareMutableStandings(
  left: MutableStanding,
  right: MutableStanding
) {
  const pointsDifference = right.points - left.points
  if (pointsDifference !== 0) return pointsDifference

  const leftAverage =
    left.countedMatches > 0
      ? left.effectiveTimeTotalMs / left.countedMatches
      : Number.POSITIVE_INFINITY
  const rightAverage =
    right.countedMatches > 0
      ? right.effectiveTimeTotalMs / right.countedMatches
      : Number.POSITIVE_INFINITY
  if (leftAverage !== rightAverage) return leftAverage - rightAverage

  const nicknameDifference = left.nickname.localeCompare(right.nickname, "en", {
    sensitivity: "base",
  })
  if (nicknameDifference !== 0) return nicknameDifference
  return left.registrationId.localeCompare(right.registrationId)
}
