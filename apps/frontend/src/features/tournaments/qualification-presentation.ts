import type {
  QualificationMatchResult,
  QualificationResultStatus,
  TimelineSegment,
} from "@mcsr-sabinsk/shared"

export const PHASE_PRESENTATION: Record<
  string,
  { label: string; color: string }
> = {
  OVERWORLD: { label: "Верхний мир", color: "#49ed68" },
  NETHER: { label: "Незер", color: "#ff5a68" },
  BASTION: { label: "Бастион", color: "#2f3131" },
  FORTRESS: { label: "Крепость", color: "#980707" },
  BLIND_TRAVEL: { label: "Слепое перемещение", color: "#7e51df" },
  STRONGHOLD: { label: "Крепость Края", color: "#79aa90" },
  THE_END: { label: "Край", color: "#d7d5a4" },
  FINISHED: { label: "Финиш", color: "#f0edbd" },
}

export function formatRaceTime(milliseconds: number | null) {
  if (milliseconds === null) return "—"

  const totalCentiseconds = Math.floor(milliseconds / 10)
  const centiseconds = totalCentiseconds % 100
  const totalSeconds = Math.floor(totalCentiseconds / 100)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)
  const secondsPart = `${String(seconds).padStart(2, "0")}.${String(
    centiseconds
  ).padStart(2, "0")}`

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${secondsPart}`
    : `${minutes}:${secondsPart}`
}

export function participantResultLabel(
  status: QualificationResultStatus,
  placement: number | null
) {
  if (status === "MISSED") return "Не участвовал"
  if (status === "DNF") return "DNF"
  return placement === null ? "Финиш" : `${placement}-е место`
}

export function phaseLabel(phase: string | null) {
  if (!phase) return "Нет данных"
  return PHASE_PRESENTATION[phase]?.label ?? phase
}

export function timelineProgressTime(timeline: TimelineSegment[]) {
  return timeline.reduce(
    (maximum, segment) => Math.max(maximum, segment.endMs),
    0
  )
}

export function matchResultTime(result: QualificationMatchResult) {
  if (result.status === "MISSED") return null
  if (result.status === "COMPLETED") return result.timeMs
  return timelineProgressTime(result.timeline) || result.effectiveTimeMs
}

export function matchResultStatus(result: QualificationMatchResult) {
  if (result.status === "MISSED") return "не участвовал"
  if (result.status === "COMPLETED") return "финиш"
  return `DNF · ${phaseLabel(result.lastPhase).toLowerCase()}`
}
