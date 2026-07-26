import type { TournamentStatus } from "@mcsr-sabinsk/shared"

interface TournamentSelectionCandidate {
  id: string
  status: TournamentStatus
  startsAt: Date
  endsAt: Date
}

const ACTIVE_STATUSES = new Set<TournamentStatus>(["QUALIFICATION", "PLAYOFF"])

export function selectDefaultTournament<T extends TournamentSelectionCandidate>(
  tournaments: readonly T[],
  now = new Date()
): T | null {
  const active = tournaments
    .filter((tournament) => ACTIVE_STATUSES.has(tournament.status))
    .sort(
      (left, right) => right.startsAt.getTime() - left.startsAt.getTime()
    )[0]
  if (active) return active

  const upcoming = tournaments
    .filter(
      (tournament) =>
        tournament.status === "UPCOMING" && tournament.startsAt >= now
    )
    .sort(
      (left, right) => left.startsAt.getTime() - right.startsAt.getTime()
    )[0]
  if (upcoming) return upcoming

  return (
    tournaments
      .filter((tournament) => tournament.status === "COMPLETED")
      .sort(
        (left, right) => right.endsAt.getTime() - left.endsAt.getTime()
      )[0] ?? null
  )
}
