import type {
  PlayoffMatchKind,
  PlayoffMatchStatus,
} from "../../generated/prisma/enums.js"

export type PlayoffSize = 4 | 8 | 16

export interface MatchSlot {
  kind: PlayoffMatchKind
  roundNumber: number
  position: number
}

export interface MatchState {
  participant1RegistrationId: string | null
  participant2RegistrationId: string | null
  score1: number | null
  score2: number | null
  winnerRegistrationId: string | null
  status: PlayoffMatchStatus
}

export interface QualificationRankedRegistration {
  qualificationPoints: number
  averageTimeMs: number | null
  nicknameSnapshot: string
  tieBreaker: string
}

export function isPlayoffSize(value: number): value is PlayoffSize {
  return value === 4 || value === 8 || value === 16
}

export function createMatchSlots(
  size: PlayoffSize,
  showThirdPlace: boolean
): MatchSlot[] {
  const rounds = Math.log2(size)
  const slots: MatchSlot[] = []
  for (let roundNumber = 1; roundNumber <= rounds; roundNumber += 1) {
    const matchCount = size / 2 ** roundNumber
    for (let position = 1; position <= matchCount; position += 1) {
      slots.push({
        kind: "MAIN",
        roundNumber,
        position,
      })
    }
  }
  if (showThirdPlace) {
    slots.push({
      kind: "THIRD_PLACE",
      roundNumber: rounds,
      position: 1,
    })
  }
  return slots
}

export function playoffRoundName(size: number, roundNumber: number) {
  const rounds = Math.log2(size)
  const remaining = rounds - roundNumber
  if (remaining === 0) return "Финал"
  if (remaining === 1) return "Полуфиналы"
  if (remaining === 2) return "Четвертьфиналы"
  return "1/8 финала"
}

export function rankPlayoffEntrants<T extends QualificationRankedRegistration>(
  registrations: T[]
) {
  return [...registrations].sort((left, right) => {
    const points = right.qualificationPoints - left.qualificationPoints
    if (points !== 0) return points

    const leftAverage = left.averageTimeMs ?? Number.POSITIVE_INFINITY
    const rightAverage = right.averageTimeMs ?? Number.POSITIVE_INFINITY
    if (leftAverage !== rightAverage) return leftAverage - rightAverage

    const nickname = left.nicknameSnapshot.localeCompare(
      right.nicknameSnapshot,
      "ru",
      { sensitivity: "base" }
    )
    if (nickname !== 0) return nickname
    return left.tieBreaker.localeCompare(right.tieBreaker)
  })
}

export function nextMainMatchTarget(
  roundNumber: number,
  position: number,
  roundCount: number
) {
  if (roundNumber >= roundCount) return null
  return {
    roundNumber: roundNumber + 1,
    position: Math.ceil(position / 2),
    slot: position % 2 === 1 ? (1 as const) : (2 as const),
  }
}

export function matchLoser(state: MatchState) {
  if (state.status !== "COMPLETED" || state.winnerRegistrationId === null) {
    return null
  }
  return state.participant1RegistrationId === state.winnerRegistrationId
    ? state.participant2RegistrationId
    : state.participant1RegistrationId
}

export function validateMatchState(state: MatchState): string | null {
  const participants = [
    state.participant1RegistrationId,
    state.participant2RegistrationId,
  ]
  if (participants[0] !== null && participants[0] === participants[1]) {
    return "Один участник не может занимать обе позиции матча."
  }
  if (state.score1 !== null && state.score1 < 0) {
    return "Счёт не может быть отрицательным."
  }
  if (state.score2 !== null && state.score2 < 0) {
    return "Счёт не может быть отрицательным."
  }
  if (state.status === "COMPLETED") {
    if (
      participants.some((participant) => participant === null) ||
      state.score1 === null ||
      state.score2 === null ||
      state.winnerRegistrationId === null
    ) {
      return "Для завершённого матча заполните обоих участников, счёт и победителя."
    }
    if (state.score1 === state.score2) {
      return "Завершённый матч не может иметь равный счёт."
    }
    if (!participants.includes(state.winnerRegistrationId)) {
      return "Победитель должен быть участником матча."
    }
  } else if (state.winnerRegistrationId !== null) {
    return "Победителя можно указать только для завершённого матча."
  }
  if (
    state.status === "READY" &&
    participants.some((participant) => participant === null)
  ) {
    return "Готовый матч должен содержать двух участников."
  }
  return null
}
