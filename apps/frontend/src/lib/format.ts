const MOSCOW_TIME_ZONE = "Europe/Moscow"

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: MOSCOW_TIME_ZONE,
})

export function formatTournamentPeriod(startsAt: string, endsAt: string) {
  return `${dateFormatter.format(new Date(startsAt))} — ${dateFormatter.format(
    new Date(endsAt)
  )}`
}

export function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) return "—"

  const totalSeconds = Math.round(milliseconds / 1_000)
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  return [
    hours > 0 ? String(hours).padStart(2, "0") : null,
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ]
    .filter((part) => part !== null)
    .join(":")
}

export function formatPlacement(placement: number | null) {
  return placement === null ? "DNF" : `${placement} место`
}
