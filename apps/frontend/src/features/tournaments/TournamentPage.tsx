import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type {
  DivisionType,
  ParticipantMatchResult,
  PublicTournament,
  QualificationMatchResult,
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
  ListOrdered,
  Swords,
  Trophy,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/cn"
import { formatDuration, formatTournamentPeriod } from "@/lib/format"

import {
  useBackendHealth,
  useDefaultTournament,
  useMatchDetails,
  useMatches,
  useParticipantDetails,
  useStandings,
  useTournaments,
} from "./queries"
import {
  formatRaceTime,
  matchResultStatus,
  matchResultTime,
  participantResultLabel,
  PHASE_PRESENTATION,
  phaseLabel,
} from "./qualification-presentation"

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

function readSelection(): Selection {
  const value = readSearchParameter("details")
  if (!value) return null
  const separator = value.indexOf(":")
  if (separator < 1) return null
  const type = value.slice(0, separator)
  const id = value.slice(separator + 1)
  if (!id || (type !== "participant" && type !== "match")) return null
  return { type, id }
}

function updateUrl(
  slug: string,
  division: DivisionType,
  selection: Selection,
  replace = false
) {
  const url = new URL(window.location.href)
  url.searchParams.set("tournament", slug)
  url.searchParams.set("division", division)
  if (selection) {
    url.searchParams.set("details", `${selection.type}:${selection.id}`)
  } else {
    url.searchParams.delete("details")
  }
  window.history[replace ? "replaceState" : "pushState"]({}, "", url)
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
  const [selection, setSelection] = useState<Selection>(() => readSelection())
  const [mobileSection, setMobileSection] = useState<"standings" | "matches">(
    "standings"
  )
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
    updateUrl(tournament.slug, division.type, selection, true)
  }, [division, selectedDivision, selectedSlug, tournament])

  useEffect(() => {
    const onPopState = () => {
      setSelectedSlug(readSearchParameter("tournament"))
      setSelectedDivision(
        readSearchParameter("division") as DivisionType | null
      )
      setSelection(readSelection())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    if (!selection) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelection(null)
        if (tournament && division) {
          updateUrl(tournament.slug, division.type, null)
        }
      }
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [division, selection, tournament])

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
    setMobileSection("standings")
    updateUrl(nextTournament.slug, nextDivision.type, null)
  }

  const selectDivision = (type: DivisionType) => {
    setSelectedDivision(type)
    setSelection(null)
    setMobileSection("standings")
    updateUrl(tournament.slug, type, null)
  }

  const selectDetails = (nextSelection: Selection) => {
    setSelection(nextSelection)
    updateUrl(tournament.slug, division.type, nextSelection)
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

      {tournament.coverUrl && (
        <div className="tournament-cover">
          <img src={tournament.coverUrl} alt={`Обложка ${tournament.name}`} />
        </div>
      )}

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

      <div
        className="competition-mobile-tabs"
        role="tablist"
        aria-label="Раздел квалификации"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileSection === "standings"}
          className={mobileSection === "standings" ? "active" : ""}
          onClick={() => setMobileSection("standings")}
        >
          <ListOrdered size={16} aria-hidden="true" />
          Лидерборд
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileSection === "matches"}
          className={mobileSection === "matches" ? "active" : ""}
          onClick={() => setMobileSection("matches")}
        >
          <Swords size={16} aria-hidden="true" />
          Матчи
        </button>
      </div>

      <section className="competition-grid">
        <div
          className={cn(
            "competition-column standings-column",
            mobileSection === "standings" && "mobile-pane-active"
          )}
        >
          <SectionTitle>Лидерборд</SectionTitle>
          <StandingsTable
            standings={standings.data?.standings}
            loading={standings.isLoading}
            error={standings.isError}
            showRanks={tournament.status !== "UPCOMING"}
            selection={selection}
            onSelect={(id) => {
              const next =
                selection?.type === "participant" && selection.id === id
                  ? null
                  : ({ type: "participant", id } satisfies Selection)
              selectDetails(next)
            }}
          />
        </div>

        <div
          className={cn(
            "competition-column matches-column",
            mobileSection === "matches" && "mobile-pane-active"
          )}
        >
          <SectionTitle>Матчи</SectionTitle>
          <MatchesList
            matches={matches.data}
            loading={matches.isLoading}
            error={matches.isError}
            upcoming={tournament.status === "UPCOMING"}
            selection={selection}
            onSelect={(id) => {
              const next =
                selection?.type === "match" && selection.id === id
                  ? null
                  : ({ type: "match", id } satisfies Selection)
              selectDetails(next)
            }}
          />
        </div>

        <DetailsPanel
          selection={selection}
          onClose={() => selectDetails(null)}
          onSelectMatch={(id) => selectDetails({ type: "match", id })}
        />
        {selection && (
          <button
            type="button"
            className="details-backdrop"
            aria-label="Закрыть подробности"
            onClick={() => selectDetails(null)}
          />
        )}
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
  error,
  showRanks,
  selection,
  onSelect,
}: {
  standings: Standing[] | undefined
  loading: boolean
  error: boolean
  showRanks: boolean
  selection: Selection
  onSelect: (id: string) => void
}) {
  if (loading) return <ListSkeleton rows={8} />
  if (error) {
    return <EmptyState>Не удалось загрузить лидерборд.</EmptyState>
  }
  if (!standings?.length) {
    return <EmptyState>Участники ещё не добавлены.</EmptyState>
  }

  return (
    <div className="standings-list">
      {standings.map((standing) => (
        <button
          type="button"
          key={standing.registrationId}
          aria-pressed={
            selection?.type === "participant" &&
            selection.id === standing.registrationId
          }
          aria-controls="qualification-details"
          onClick={() => onSelect(standing.registrationId)}
          className={cn(
            "standing-row",
            selection?.type === "participant" &&
              selection.id === standing.registrationId &&
              "row-selected"
          )}
        >
          <span className="rank">{showRanks ? standing.rank : "—"}</span>
          <span className="player-name">{standing.nickname}</span>
          <span className="points">
            {showRanks ? `${standing.points} очк.` : "Ожидает старта"}
          </span>
        </button>
      ))}
    </div>
  )
}

function MatchesList({
  matches,
  loading,
  error,
  upcoming,
  selection,
  onSelect,
}: {
  matches: QualificationMatchSummary[] | undefined
  loading: boolean
  error: boolean
  upcoming: boolean
  selection: Selection
  onSelect: (id: string) => void
}) {
  if (loading) return <ListSkeleton rows={5} />
  if (error) {
    return <EmptyState>Не удалось загрузить список матчей.</EmptyState>
  }
  if (!matches?.length) {
    return (
      <EmptyState>
        {upcoming
          ? "Квалификация ещё не началась."
          : "Завершённых матчей пока нет."}
      </EmptyState>
    )
  }

  return (
    <div className="matches-list">
      {matches.map((match) => (
        <button
          type="button"
          key={match.id}
          aria-pressed={
            selection?.type === "match" && selection.id === match.id
          }
          aria-controls="qualification-details"
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
  onSelectMatch,
}: {
  selection: Selection
  onClose: () => void
  onSelectMatch: (id: string) => void
}) {
  return (
    <aside
      id="qualification-details"
      className={cn("details-panel", selection && "details-panel-open")}
      aria-label="Подробности квалификации"
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
        <ParticipantDetails
          registrationId={selection.id}
          onSelectMatch={onSelectMatch}
        />
      ) : (
        <MatchDetails matchId={selection.id} />
      )}
    </aside>
  )
}

function ParticipantDetails({
  registrationId,
  onSelectMatch,
}: {
  registrationId: string
  onSelectMatch: (id: string) => void
}) {
  const details = useParticipantDetails(registrationId)
  if (details.isLoading) return <ListSkeleton rows={5} />
  if (details.isError || !details.data) {
    return <EmptyState>Не удалось загрузить данные участника.</EmptyState>
  }

  return (
    <div className="participant-details">
      <div className="details-heading">
        <span>#{details.data.rank}</span>
        <a
          href={`https://mcsrranked.com/stats/${details.data.participantUuid}`}
          target="_blank"
          rel="noreferrer"
        >
          {details.data.nickname}
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
      <div className="participant-summary">
        <p>
          <strong>{details.data.points}</strong> очков ·{" "}
          {details.data.matches.length} матчей
        </p>
        <span>Среднее время {formatDuration(details.data.averageTimeMs)}</span>
      </div>
      <div className="placement-list">
        {details.data.matches.map((match) => (
          <button
            type="button"
            key={match.matchId}
            onClick={() => onSelectMatch(match.matchId)}
          >
            <span>Матч {match.matchNumber}</span>
            <strong data-placement={placementTone(match)}>
              {participantResultLabel(match.status, match.placement)}
            </strong>
            <span>+{match.points} очк.</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function placementTone(match: ParticipantMatchResult) {
  if (match.status !== "COMPLETED") return match.status.toLowerCase()
  if (match.placement === 1) return "gold"
  if (match.placement === 2 || match.placement === 3) return "podium"
  return "regular"
}

function MatchDetails({ matchId }: { matchId: string }) {
  const details = useMatchDetails(matchId)
  if (details.isLoading) return <ListSkeleton rows={5} />
  if (details.isError || !details.data) {
    return <EmptyState>Не удалось загрузить матч.</EmptyState>
  }

  return (
    <div className="match-details">
      <div className="details-heading">
        <span>Матч {details.data.matchNumber}</span>
        <strong>Ranked #{details.data.rankedMatchId}</strong>
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
            <div className="result-content">
              <div className="result-meta">
                <strong>{result.nickname}</strong>
                <span>{formatRaceTime(matchResultTime(result))}</span>
                <em>{matchResultStatus(result)}</em>
              </div>
              <TimelineBar
                result={result}
                timeLimitMs={details.data.timeLimitMs}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineBar({
  result,
  timeLimitMs,
}: {
  result: QualificationMatchResult
  timeLimitMs: number
}) {
  if (result.status === "MISSED" || result.timeline.length === 0) {
    return (
      <div className="timeline-empty">
        <span>Нет timeline</span>
      </div>
    )
  }

  const totalTime = Math.max(
    result.status === "COMPLETED"
      ? (result.timeMs ?? result.effectiveTimeMs)
      : matchResultTime(result) || result.effectiveTimeMs,
    1
  )
  const scaleTime =
    result.status === "DNF" ? Math.max(timeLimitMs, totalTime) : totalTime

  return (
    <div
      className="timeline-bar"
      aria-label={`Timeline: ${phaseLabel(result.lastPhase)}`}
    >
      {result.timeline.map((segment, index) => {
        const duration = Math.max(segment.endMs - segment.startMs, 1)
        const phase = PHASE_PRESENTATION[segment.phase] ?? {
          label: segment.phase,
          color: "#7a8589",
        }
        const tooltip = `${phase.label}: ${formatRaceTime(
          duration
        )}, начало ${formatRaceTime(segment.startMs)}`
        return (
          <span
            key={`${segment.phase}-${segment.startMs}-${index}`}
            className="timeline-segment"
            style={{
              backgroundColor: phase.color,
              width: `${(duration / scaleTime) * 100}%`,
            }}
            title={tooltip}
            aria-label={tooltip}
          />
        )
      })}
      {result.status === "DNF" && totalTime < timeLimitMs && (
        <span
          className="timeline-remaining"
          style={{
            width: `${((timeLimitMs - totalTime) / timeLimitMs) * 100}%`,
          }}
          title={`До лимита: ${formatRaceTime(timeLimitMs - totalTime)}`}
          aria-hidden="true"
        />
      )}
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
