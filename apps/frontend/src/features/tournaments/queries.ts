import { useQuery } from "@tanstack/react-query"
import type {
  ParticipantQualification,
  PublicPlayoff,
  PublicTournament,
  QualificationMatchDetails,
  QualificationMatchSummary,
  StandingsResponse,
} from "@mcsr-sabinsk/shared"

import { apiRequest } from "@/lib/api-client"

export function useBackendHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) =>
      apiRequest<{ status: string }>("/health/live", signal),
    retry: 1,
    staleTime: 30_000,
  })
}

export function useTournaments() {
  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `${import.meta.env.PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1"}/tournaments?limit=100`,
        { headers: { Accept: "application/json" }, signal }
      )
      if (!response.ok) {
        throw new Error("Не удалось загрузить турниры.")
      }
      const payload = (await response.json()) as {
        data: PublicTournament[]
      }
      return payload.data
    },
    staleTime: 30_000,
  })
}

export function useDefaultTournament(enabled: boolean) {
  return useQuery({
    queryKey: ["tournaments", "default"],
    queryFn: ({ signal }) =>
      apiRequest<PublicTournament>("/tournaments/default", signal),
    enabled,
    retry: false,
    staleTime: 30_000,
  })
}

export function useStandings(slug: string | null, divisionType: string | null) {
  return useQuery({
    queryKey: ["standings", slug, divisionType],
    queryFn: ({ signal }) =>
      apiRequest<StandingsResponse>(
        `/tournaments/${slug}/divisions/${divisionType}/standings`,
        signal
      ),
    enabled: slug !== null && divisionType !== null,
    staleTime: 30_000,
  })
}

export function useMatches(slug: string | null, divisionType: string | null) {
  return useQuery({
    queryKey: ["matches", slug, divisionType],
    queryFn: ({ signal }) =>
      apiRequest<QualificationMatchSummary[]>(
        `/tournaments/${slug}/divisions/${divisionType}/matches`,
        signal
      ),
    enabled: slug !== null && divisionType !== null,
    staleTime: 30_000,
  })
}

export function usePlayoff(
  slug: string | null,
  divisionType: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["playoff", slug, divisionType],
    queryFn: ({ signal }) =>
      apiRequest<PublicPlayoff>(
        `/tournaments/${slug}/divisions/${divisionType}/playoff`,
        signal
      ),
    enabled: enabled && slug !== null && divisionType !== null,
    retry: false,
    staleTime: 30_000,
  })
}

export function useParticipantDetails(registrationId: string | null) {
  return useQuery({
    queryKey: ["participant", registrationId],
    queryFn: ({ signal }) =>
      apiRequest<ParticipantQualification>(
        `/registrations/${registrationId}/qualification`,
        signal
      ),
    enabled: registrationId !== null,
    staleTime: 30_000,
  })
}

export function useMatchDetails(matchId: string | null) {
  return useQuery({
    queryKey: ["match", matchId],
    queryFn: ({ signal }) =>
      apiRequest<QualificationMatchDetails>(
        `/qualification-matches/${matchId}`,
        signal
      ),
    enabled: matchId !== null,
    staleTime: 30_000,
  })
}
