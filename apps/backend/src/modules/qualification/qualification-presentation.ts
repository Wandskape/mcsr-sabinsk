import type {
  QualificationMatchResult,
  QualificationResultStatus,
} from "@mcsr-sabinsk/shared"

const STATUS_ORDER: Record<QualificationResultStatus, number> = {
  COMPLETED: 0,
  DNF: 1,
  MISSED: 2,
}

const PHASE_ORDER: Record<string, number> = {
  OVERWORLD: 0,
  NETHER: 1,
  BASTION: 2,
  FORTRESS: 3,
  BLIND_TRAVEL: 4,
  STRONGHOLD: 5,
  THE_END: 6,
  FINISHED: 7,
}

function progressTime(result: QualificationMatchResult) {
  return result.timeline.reduce(
    (maximum, segment) => Math.max(maximum, segment.endMs),
    0
  )
}

export function sortQualificationMatchResults(
  results: QualificationMatchResult[]
) {
  return [...results].sort((left, right) => {
    const statusDifference =
      STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
    if (statusDifference !== 0) return statusDifference

    if (left.status === "COMPLETED" && right.status === "COMPLETED") {
      const placementDifference =
        (left.placement ?? Number.POSITIVE_INFINITY) -
        (right.placement ?? Number.POSITIVE_INFINITY)
      if (placementDifference !== 0) return placementDifference
      const timeDifference =
        (left.timeMs ?? Number.POSITIVE_INFINITY) -
        (right.timeMs ?? Number.POSITIVE_INFINITY)
      if (timeDifference !== 0) return timeDifference
    }

    if (left.status === "DNF" && right.status === "DNF") {
      const phaseDifference =
        (PHASE_ORDER[right.lastPhase ?? ""] ?? -1) -
        (PHASE_ORDER[left.lastPhase ?? ""] ?? -1)
      if (phaseDifference !== 0) return phaseDifference
      const timeDifference = progressTime(right) - progressTime(left)
      if (timeDifference !== 0) return timeDifference
    }

    const nicknameDifference = left.nickname.localeCompare(
      right.nickname,
      "en",
      { sensitivity: "base" }
    )
    if (nicknameDifference !== 0) return nicknameDifference
    return left.participantUuid.localeCompare(right.participantUuid)
  })
}
