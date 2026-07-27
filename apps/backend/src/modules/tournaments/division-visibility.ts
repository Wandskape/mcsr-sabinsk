import type { TournamentStatus } from "../../generated/prisma/client.js"

export function isDivisionPublic(
  tournamentStatus: TournamentStatus,
  isParticipating: boolean
) {
  return tournamentStatus === "UPCOMING" || isParticipating
}
