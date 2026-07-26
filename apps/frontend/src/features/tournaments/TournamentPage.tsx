import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type {
  DivisionType,
  PublicTournament,
  QualificationMatchSummary,
  Standing,
  TournamentStatus,
} from "@mcsr-sabinsk/shared"
import { TOURNAMENT_STATUS_LABELS } from "@mcsr-sabinsk/shared"
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  ExternalLink,
  Trophy,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/cn"
import {
  formatDuration,
  formatPlacement,
  formatTournamentPeriod,
} from "@/lib/format"

import {
  useBackendHealth,
  useDefaultTournament,
  useMatchDetails,
  useMatches,
  useParticipantDetails,
  useStandings,
  useTournaments,
} from "./queries"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

type Selection =
  { type: "participant"; id: string } | { type: "match"; id: string } | null

function readSearchParameter(name: string) {
  if (typeof window === "undefined") return null
  return new URL(window.location.href).searchParams.get(name)
}

function updateUrl(slug: string, division: DivisionType) {
  const url = new URL(window.location.href)
  url.searchParams.set("tournament", slug)
  url.searchParams.set("division", division)
  window.history.pushState({}, "", url)
}

function TournamentContent() {
  const health = useBackendHealth()
  const tournamentsQuery = useTournaments()
  const defaultTournamentQuery = useDefaultTournament(
    tournamentsQuery.data !== undefined &&
      readSearchParameter("tournament") === null
  )
  const [selectedSlug, setSelectedSlug] = useState<string | null>(() =>
    readSearchParameter("tournament")
  )
  const [selectedDivision, setSelectedDivision] = useState<DivisionType | null>(
    () => readSearchParameter("division") as DivisionType | null
  )
  const [selection, setSelection] = useState<Selection>(null)
  const tournaments = tournamentsQuery.data ?? []

  const tournament = useMemo(() => {
    if (selectedSlug) {
      return (
        tournaments.find((candidate) => candidate.slug === selectedSlug) ?? null
      )
    }
    return defaultTournamentQuery.data ?? tournaments.at(0) ?? null
  }, [defaultTournamentQuery.data, selectedSlug, tournaments])

  const division = useMemo(() => {
    if (!tournament) return null
    return (
      tournament.divisions.find(
        (candidate) => candidate.type === selectedDivision
      ) ??
      tournament.divisions.at(0) ??
      null
    )
  }, [selectedDivision, tournament])

  useEffect(() => {
    if (!tournament || !division) return
    if (selectedSlug !== tournament.slug) {
      setSelectedSlug(tournament.slug)
    }
    if (selectedDivision !== division.type) {
      setSelectedDivision(division.type)
    }
    updateUrl(tournament.slug, division.type)
  }, [division, selectedDivision, selectedSlug, tournament])

  useEffect(() => {
    const onPopState = () => {
      setSelectedSlug(readSearchParameter("tournament"))
      setSelectedDivision(
        readSearchParameter("division") as DivisionType | null
      )
      setSelection(null)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const standings = useStandings(
    tournament?.slug ?? null,
    division?.type ?? null
  )
  const matches = useMatches(tournament?.slug ?? null, division?.type ?? null)

  if (tournamentsQuery.isLoading) {
    return <PageSkeleton />
  }

  if (tournamentsQuery.isError) {
    return (
      <PageMessage
        title="Backend пока недоступен"
        description="Запустите PostgreSQL и backend, затем обновите страницу."
      />
    )
  }

  if (!tournament || !division) {
    return (
      <PageMessage
        title="Турниры пока не опубликованы"
        description="После публикации турнира в админ-панели он появится на этой странице."
      />
    )
  }

  const selectTournament = (nextTournament: PublicTournament) => {
    const nextDivision =
      nextTournament.divisions.find(
        (candidate) => candidate.type === selectedDivision
      ) ?? nextTournament.divisions.at(0)
    if (!nextDivision) return
    setSelectedSlug(nextTournament.slug)
    setSelectedDivision(nextDivision.type)
    setSelection(null)
    updateUrl(nextTournament.slug, nextDivision.type)
  }

  const selectDivision = (type: DivisionType) => {
    setSelectedDivision(type)
    setSelection(null)
    updateUrl(tournament.slug, type)
  }

  return (
    <div className="page-shell">
      <section className="tournament-heading">
        <div>
          <div className="eyebrow-row">
            <span className="eyebrow">Турниры</span>
            <StatusBadge status={tournament.status} />
            <span
              className={cn(
                "backend-state",
                health.isError && "backend-state-error"
              )}
              title={
                health.isError
                  ? "Backend недоступен"
                  : "Соединение с backend установлено"
              }
            >
              <span aria-hidden="true" />
              API
            </span>
          </div>
          <h1>{tournament.name}</h1>
          <p className="tournament-period">
            {formatTournamentPeriod(tournament.startsAt, tournament.endsAt)}
          </p>
        </div>
        <TournamentSelector
          tournaments={tournaments}
          selected={tournament}
          onSelect={selectTournament}
        />
      </section>

      {tournament.description && (
        <p className="tournament-description">{tournament.description}</p>
      )}

      <nav className="division-tabs" aria-label="Дивизионы">
        {tournament.divisions.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={cn(
              "division-tab",
              candidate.type === division.type && "division-tab-active"
            )}
            aria-current={candidate.type === division.type ? "page" : undefined}
            onClick={() => selectDivision(candidate.type)}
          >
            {candidate.displayName}
          </button>
        ))}
      </nav>

      <section className="competition-grid">
        <div className="competition-column standings-column">
          <SectionTitle>Лидерборд</SectionTitle>
          <StandingsTable
            standings={standings.data?.standings}
            loading={standings.isLoading}
            selection={selection}
            onSelect={(id) =>
              setSelection((current) =>
                current?.type === "participant" && current.id === id
                  ? null
                  : { type: "participant", id }
              )
            }
          />
        </div>

        <div className="competition-column matches-column">
          <SectionTitle>Матчи</SectionTitle>
          <MatchesList
            matches={matches.data}
            loading={matches.isLoading}
            selection={selection}
            onSelect={(id) =>
              setSelection((current) =>
                current?.type === "match" && current.id === id
                  ? null
                  : { type: "match", id }
              )
            }
          />
        </div>

        <DetailsPanel
          selection={selection}
          onClose={() => setSelection(null)}
        />
      </section>
    </div>
  )
}

function TournamentSelector({
  tournaments,
  selected,
  onSelect,
}: {
  tournaments: PublicTournament[]
  selected: PublicTournament
  onSelect: (tournament: PublicTournament) => void
}) {
  const index = tournaments.findIndex(
    (tournament) => tournament.id === selected.id
  )
  const previous = tournaments[index + 1]
  const next = tournaments[index - 1]

  return (
    <div className="tournament-selector">
      <button
        type="button"
        aria-label="Предыдущий турнир"
        disabled={!previous}
        onClick={() => previous && onSelect(previous)}
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <label>
        <span className="sr-only">Выберите турнир</span>
        <select
          value={selected.id}
          onChange={(event) => {
            const chosen = tournaments.find(
              (tournament) => tournament.id === event.target.value
            )
            if (chosen) onSelect(chosen)
          }}
        >
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.name} ·{" "}
              {formatTournamentPeriod(tournament.startsAt, tournament.endsAt)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        aria-label="Следующий турнир"
        disabled={!next}
        onClick={() => next && onSelect(next)}
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  )
}

function StatusBadge({ status }: { status: TournamentStatus }) {
  return (
    <span className={cn("status-badge", `status-${status.toLowerCase()}`)}>
      {TOURNAMENT_STATUS_LABELS[status]}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="section-title">{children}</h2>
}

function StandingsTable({
  standings,
  loading,
  selection,
  onSelect,
}: {
  standings: Standing[] | undefined
  loading: boolean
  selection: Selection
  onSelect: (id: string) => void
}) {
  if (loading) return <ListSkeleton rows={8} />
  if (!standings?.length) {
    return <EmptyState>Участники ещё не добавлены.</EmptyState>
  }

  return (
    <div className="standings-list">
      {standings.map((standing) => (
        <button
          type="button"
          key={standing.registrationId}
          onClick={() => onSelect(standing.registrationId)}
          className={cn(
            "standing-row",
            selection?.type === "participant" &&
              selection.id === standing.registrationId &&
              "row-selected"
          )}
        >
          <span className="rank">{standing.rank}</span>
          <span className="player-name">{standing.nickname}</span>
          <span className="points">{standing.points} очк.</span>
        </button>
      ))}
    </div>
  )
}

function MatchesList({
  matches,
  loading,
  selection,
  onSelect,
}: {
  matches: QualificationMatchSummary[] | undefined
  loading: boolean
  selection: Selection
  onSelect: (id: string) => void
}) {
  if (loading) return <ListSkeleton rows={5} />
  if (!matches?.length) {
    return <EmptyState>Завершённых матчей пока нет.</EmptyState>
  }

  return (
    <div className="matches-list">
      {matches.map((match) => (
        <button
          type="button"
          key={match.id}
          onClick={() => onSelect(match.id)}
          className={cn(
            "match-row",
            selection?.type === "match" &&
              selection.id === match.id &&
              "row-selected"
          )}
        >
          <span>Матч {match.matchNumber}</span>
          <span className="match-winner">
            <Crown aria-hidden="true" />
            {match.winner?.nickname ?? "Нет победителя"}
          </span>
        </button>
      ))}
    </div>
  )
}

function DetailsPanel({
  selection,
  onClose,
}: {
  selection: Selection
  onClose: () => void
}) {
  return (
    <aside
      className={cn("details-panel", selection && "details-panel-open")}
      aria-live="polite"
    >
      {selection && (
        <button
          type="button"
          className="details-close"
          aria-label="Закрыть подробности"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      )}
      {!selection ? (
        <div className="details-placeholder">
          <Trophy aria-hidden="true" />
          <p>Выберите участника или завершённый матч.</p>
        </div>
      ) : selection.type === "participant" ? (
        <ParticipantDetails registrationId={selection.id} />
      ) : (
        <MatchDetails matchId={selection.id} />
      )}
    </aside>
  )
}

function ParticipantDetails({ registrationId }: { registrationId: string }) {
  const details = useParticipantDetails(registrationId)
  if (details.isLoading) return <ListSkeleton rows={5} />
  if (!details.data) {
    return <EmptyState>Не удалось загрузить участника.</EmptyState>
  }

  return (
    <div className="participant-details">
      <div className="details-heading">
        <span>#{details.data.rank}</span>
        <a
          href={`https://mcsrranked.com/stats/${details.data.nickname}`}
          target="_blank"
          rel="noreferrer"
        >
          {details.data.nickname}
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
      <p>
        <strong>{details.data.points}</strong> очков ·{" "}
        {details.data.matches.length} матчей · среднее{" "}
        {formatDuration(details.data.averageTimeMs)}
      </p>
      <div className="placement-list">
        {details.data.matches.map((match) => (
          <div key={match.matchId}>
            <span>Матч {match.matchNumber}</span>
            <strong>{formatPlacement(match.placement)}</strong>
            <span>+{match.points} очк.</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchDetails({ matchId }: { matchId: string }) {
  const details = useMatchDetails(matchId)
  if (details.isLoading) return <ListSkeleton rows={5} />
  if (!details.data) {
    return <EmptyState>Не удалось загрузить матч.</EmptyState>
  }

  return (
    <div className="match-details">
      <div className="details-heading">
        <span>Матч {details.data.matchNumber}</span>
        <strong>#{details.data.rankedMatchId}</strong>
      </div>
      <div className="result-list">
        {details.data.results.map((result) => (
          <div className="result-row" key={result.registrationId}>
            <img
              src={result.avatarUrl}
              width="40"
              height="40"
              alt=""
              loading="lazy"
            />
            <div>
              <strong>{result.nickname}</strong>
              <span>{result.lastPhase ?? result.status}</span>
            </div>
            <span>
              {result.placement ?? "—"} · {formatDuration(result.timeMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="skeleton-list" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="empty-state">{children}</p>
}

function PageSkeleton() {
  return (
    <div className="page-shell page-skeleton" aria-label="Загрузка турнира">
      <span />
      <span />
      <span />
    </div>
  )
}

function PageMessage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="page-message">
      <Trophy aria-hidden="true" />
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

export function TournamentPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <TournamentContent />
    </QueryClientProvider>
  )
}
