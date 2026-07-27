import type {
  QualificationIgnoredPlayer,
  QualificationImportPreviewResult,
  QualificationResultStatus,
  RankedMatchPayload,
  TimelineSegment,
} from "@mcsr-sabinsk/shared"

interface RegistrationInput {
  id: string
  participantUuid: string
  nickname: string
}

interface CalculatedMatch {
  rankedMatchId: string
  playedAt: Date
  participantCount: number
  winnerRegistrationId: string | null
  results: QualificationImportPreviewResult[]
  ignoredPlayers: QualificationIgnoredPlayer[]
  warnings: string[]
}

const PHASE_BY_EVENT: Record<string, string> = {
  "projectelo.timeline.reset": "OVERWORLD",
  "story.enter_the_nether": "NETHER",
  "nether.find_bastion": "BASTION",
  "nether.loot_bastion": "BASTION",
  "nether.find_fortress": "FORTRESS",
  "nether.obtain_blaze_rod": "FORTRESS",
  "projectelo.timeline.blind_travel": "BLIND_TRAVEL",
  "story.follow_ender_eye": "STRONGHOLD",
  "story.enter_the_end": "THE_END",
}

export function calculateQualificationMatch(
  payload: RankedMatchPayload,
  registrations: RegistrationInput[],
  timeLimitMs: number
): CalculatedMatch {
  const registrationByUuid = new Map(
    registrations.map((registration) => [
      registration.participantUuid.toLowerCase(),
      registration,
    ])
  )
  const rankedPlayers = new Map(
    payload.players.map((player) => [player.uuid.toLowerCase(), player])
  )
  const actualRegistrations = registrations.filter((registration) =>
    rankedPlayers.has(registration.participantUuid.toLowerCase())
  )
  const participantCount = actualRegistrations.length

  const completions = new Map(
    payload.completions.map((completion) => [
      completion.uuid.toLowerCase(),
      completion.time,
    ])
  )
  const eventsByUuid = new Map<string, Array<{ time: number; type: string }>>()
  for (const event of payload.timelines) {
    const uuid = event.uuid.toLowerCase()
    const current = eventsByUuid.get(uuid) ?? []
    current.push({ time: event.time, type: event.type })
    eventsByUuid.set(uuid, current)
  }
  for (const events of eventsByUuid.values()) {
    events.sort((left, right) => left.time - right.time)
  }

  const resultDrafts = registrations.map((registration) => {
    const uuid = registration.participantUuid.toLowerCase()
    const participated = rankedPlayers.has(uuid)
    const completionTime = completions.get(uuid)
    const completed =
      participated &&
      completionTime !== undefined &&
      completionTime <= timeLimitMs
    const status: QualificationResultStatus = !participated
      ? "MISSED"
      : completed
        ? "COMPLETED"
        : "DNF"
    const rawTimeMs = completionTime ?? null
    const effectiveTimeMs = completed ? completionTime : timeLimitMs
    const timelineEnd = completed
      ? completionTime
      : Math.min(
          completionTime ?? eventsByUuid.get(uuid)?.at(-1)?.time ?? timeLimitMs,
          timeLimitMs
        )
    const normalized = participated
      ? normalizeTimeline(eventsByUuid.get(uuid) ?? [], timelineEnd, completed)
      : { timeline: [], lastPhase: null }

    return {
      registrationId: registration.id,
      participantUuid: uuid,
      nickname: registration.nickname,
      status,
      placement: null as number | null,
      rawTimeMs,
      effectiveTimeMs,
      points: 0,
      lastPhase: normalized.lastPhase,
      timeline: normalized.timeline,
    }
  })

  const completed = resultDrafts
    .filter((result) => result.status === "COMPLETED")
    .sort((left, right) => {
      const timeDifference =
        (left.rawTimeMs ?? Number.POSITIVE_INFINITY) -
        (right.rawTimeMs ?? Number.POSITIVE_INFINITY)
      if (timeDifference !== 0) return timeDifference
      const nicknameDifference = left.nickname.localeCompare(
        right.nickname,
        "en",
        { sensitivity: "base" }
      )
      if (nicknameDifference !== 0) return nicknameDifference
      return left.participantUuid.localeCompare(right.participantUuid)
    })
  const pointsPlaces = Math.floor(participantCount / 2)
  completed.forEach((result, index) => {
    const placement = index + 1
    result.placement = placement
    result.points = calculatePoints(placement, pointsPlaces)
  })

  const ignoredPlayers = [...rankedPlayers.values()]
    .filter((player) => !registrationByUuid.has(player.uuid.toLowerCase()))
    .map((player) => ({
      participantUuid: player.uuid.toLowerCase(),
      nickname: player.nickname,
    }))
  const warnings: string[] = []
  const missedCount = resultDrafts.filter(
    (result) => result.status === "MISSED"
  ).length
  const dnfCount = resultDrafts.filter(
    (result) => result.status === "DNF"
  ).length
  if (missedCount > 0) {
    warnings.push(`Пропустили матч: ${missedCount}.`)
  }
  if (dnfCount > 0) {
    warnings.push(`DNF или превышение лимита: ${dnfCount}.`)
  }
  if (ignoredPlayers.length > 0) {
    warnings.push(
      `Посторонние игроки проигнорированы: ${ignoredPlayers.length}.`
    )
  }

  return {
    rankedMatchId: String(payload.id),
    playedAt: parseRankedDate(payload.date),
    participantCount,
    winnerRegistrationId: completed[0]?.registrationId ?? null,
    results: resultDrafts,
    ignoredPlayers,
    warnings,
  }
}

export function calculatePoints(placement: number, pointsPlaces: number) {
  if (placement > pointsPlaces) return 0
  const bonus =
    placement === 1 ? 5 : placement === 2 ? 3 : placement === 3 ? 1 : 0
  return pointsPlaces - (placement - 1) + bonus
}

function normalizeTimeline(
  events: Array<{ time: number; type: string }>,
  finalTimeMs: number,
  completed: boolean
): { timeline: TimelineSegment[]; lastPhase: string } {
  const usableEnd = Math.max(0, finalTimeMs)
  let currentPhase = "OVERWORLD"
  let currentStart = 0
  const segments: TimelineSegment[] = []
  const dragonDeath = events.find(
    (event) =>
      event.type === "projectelo.timeline.dragon_death" &&
      event.time < usableEnd
  )
  const phaseEnd = completed && dragonDeath ? dragonDeath.time : usableEnd

  for (const event of events) {
    if (event.time > phaseEnd) break
    const nextPhase = PHASE_BY_EVENT[event.type]
    if (!nextPhase || nextPhase === currentPhase) continue
    if (event.time > currentStart) {
      segments.push({
        phase: currentPhase,
        startMs: currentStart,
        endMs: event.time,
      })
    }
    currentPhase = nextPhase
    currentStart = event.time
  }

  if (phaseEnd > currentStart) {
    segments.push({
      phase: currentPhase,
      startMs: currentStart,
      endMs: phaseEnd,
    })
  }
  if (completed && dragonDeath && dragonDeath.time < usableEnd) {
    segments.push({
      phase: "FINISHED",
      startMs: dragonDeath.time,
      endMs: usableEnd,
    })
  }

  return {
    timeline: segments,
    lastPhase: completed ? "FINISHED" : currentPhase,
  }
}

function parseRankedDate(value: string | number) {
  const date =
    typeof value === "number"
      ? new Date(value < 1_000_000_000_000 ? value * 1_000 : value)
      : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Ranked match contains an invalid date")
  }
  return date
}
