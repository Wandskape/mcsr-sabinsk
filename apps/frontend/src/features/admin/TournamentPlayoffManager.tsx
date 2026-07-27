import type {
  AdminPlayoff,
  AdminSession,
  AdminTournament,
  PlayoffMatch,
} from "@mcsr-sabinsk/shared"
import {
  Eye,
  EyeOff,
  LoaderCircle,
  Save,
  Settings2,
  Swords,
  Trophy,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { ApiError, apiCommand, apiRequest } from "@/lib/api-client"

interface Props {
  session: AdminSession
  tournament: AdminTournament
  onTournamentChanged: (tournament: AdminTournament) => void
}

export function TournamentPlayoffManager({
  session,
  tournament,
  onTournamentChanged,
}: Props) {
  const divisions = tournament.divisions.filter(
    (division) => division.isParticipating
  )
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? "")
  const [bracket, setBracket] = useState<AdminPlayoff | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [size, setSize] = useState<4 | 8 | 16>(8)
  const [showThirdPlace, setShowThirdPlace] = useState(false)
  const division =
    divisions.find((candidate) => candidate.id === divisionId) ?? divisions[0]

  useEffect(() => {
    if (!division && divisions[0]) setDivisionId(divisions[0].id)
  }, [division, divisions])

  useEffect(() => {
    if (!division) return
    setSize(
      division.registrationCount >= 16
        ? 16
        : division.registrationCount >= 8
          ? 8
          : 4
    )
  }, [division?.id, division?.registrationCount])

  useEffect(() => {
    if (!division) {
      setBracket(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    apiRequest<AdminPlayoff>(
      `/admin/divisions/${division.id}/playoff`,
      controller.signal
    )
      .then(setBracket)
      .catch((reason) => {
        if (reason instanceof ApiError && reason.status === 404) {
          setBracket(null)
          return
        }
        if (reason instanceof DOMException && reason.name === "AbortError") {
          return
        }
        setError(messageFor(reason))
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [division?.id])

  if (
    tournament.status === "DRAFT" ||
    tournament.status === "UPCOMING" ||
    divisions.length === 0
  ) {
    return null
  }

  async function refreshTournament() {
    const refreshed = await apiRequest<AdminTournament>(
      `/admin/tournaments/${tournament.id}`
    )
    onTournamentChanged(refreshed)
  }

  async function createBracket() {
    if (!division) return
    setBusy("create")
    setError(null)
    setNotice(null)
    try {
      const created = await apiCommand<AdminPlayoff>(
        `/admin/divisions/${division.id}/playoff`,
        {
          method: "POST",
          body: {
            size,
            showThirdPlace,
            expectedDivisionVersion: division.version,
          },
          csrfToken: session.csrfToken,
        }
      )
      setBracket(created)
      await refreshTournament()
      setNotice("Сетка создана. Назначьте пары первого раунда.")
    } catch (reason) {
      setError(messageFor(reason))
    } finally {
      setBusy(null)
    }
  }

  async function updateSettings(nextShowThirdPlace: boolean) {
    if (!bracket) return
    setBusy("settings")
    setError(null)
    try {
      const updated = await apiCommand<AdminPlayoff>(
        `/admin/playoffs/${bracket.id}`,
        {
          method: "PATCH",
          body: {
            showThirdPlace: nextShowThirdPlace,
            expectedVersion: bracket.version,
          },
          csrfToken: session.csrfToken,
        }
      )
      setBracket(updated)
      setNotice(
        nextShowThirdPlace
          ? "Матч за третье место включён."
          : "Матч за третье место скрыт."
      )
    } catch (reason) {
      setError(messageFor(reason))
    } finally {
      setBusy(null)
    }
  }

  async function setPublication(isPublished: boolean) {
    if (!bracket) return
    if (
      !window.confirm(
        isPublished
          ? "Опубликовать сетку на странице турнира?"
          : "Скрыть сетку с публичной страницы?"
      )
    ) {
      return
    }
    setBusy("publication")
    setError(null)
    try {
      const updated = await apiCommand<AdminPlayoff>(
        `/admin/playoffs/${bracket.id}/${isPublished ? "publish" : "unpublish"}`,
        {
          method: "POST",
          body: { expectedVersion: bracket.version },
          csrfToken: session.csrfToken,
        }
      )
      setBracket(updated)
      setNotice(isPublished ? "Сетка опубликована." : "Сетка скрыта.")
      await refreshTournament()
    } catch (reason) {
      setError(messageFor(reason))
    } finally {
      setBusy(null)
    }
  }

  async function saveMatch(match: PlayoffMatch, values: MatchEditorValues) {
    if (!bracket) return
    setBusy(match.id)
    setError(null)
    setNotice(null)
    try {
      const bothParticipants =
        values.participant1RegistrationId !== null &&
        values.participant2RegistrationId !== null
      const completed =
        bothParticipants &&
        values.score1 !== null &&
        values.score2 !== null &&
        values.winnerRegistrationId !== null
      const updated = await apiCommand<AdminPlayoff>(
        `/admin/playoff-matches/${match.id}`,
        {
          method: "PATCH",
          body: {
            ...values,
            score1: bothParticipants ? values.score1 : null,
            score2: bothParticipants ? values.score2 : null,
            winnerRegistrationId: completed
              ? values.winnerRegistrationId
              : null,
            status: completed
              ? "COMPLETED"
              : bothParticipants
                ? "READY"
                : "EMPTY",
            expectedVersion: match.version,
          },
          csrfToken: session.csrfToken,
        }
      )
      setBracket(updated)
      setNotice("Матч сохранён.")
    } catch (reason) {
      setError(messageFor(reason))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="admin-editor-section admin-playoff-manager">
      <div className="admin-playoff-heading">
        <div>
          <h3>Плей-офф</h3>
          <p>Ручная сетка, пары, счёт и победители.</p>
        </div>
        <Trophy size={22} aria-hidden="true" />
      </div>

      <nav className="admin-division-tabs" aria-label="Дивизионы плей-офф">
        {divisions.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={candidate.id === division?.id ? "active" : ""}
            onClick={() => {
              setDivisionId(candidate.id)
              setNotice(null)
              setError(null)
            }}
          >
            {candidate.displayName}
          </button>
        ))}
      </nav>

      {error && (
        <div className="admin-alert admin-alert-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="admin-alert admin-alert-success" role="status">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="admin-inline-state">
          <LoaderCircle className="spin" size={20} aria-hidden="true" />
          Загружаем сетку…
        </div>
      ) : !bracket && division ? (
        <div className="admin-playoff-create">
          <div>
            <strong>
              Создать сетку для дивизиона «{division.displayName}»
            </strong>
            <p>
              В дивизионе {division.registrationCount} участников. Размер после
              создания изменить нельзя.
            </p>
          </div>
          <label>
            <span>Игроков в сетке</span>
            <select
              value={size}
              onChange={(event) =>
                setSize(Number(event.currentTarget.value) as 4 | 8 | 16)
              }
            >
              {[4, 8, 16].map((candidate) => (
                <option
                  key={candidate}
                  value={candidate}
                  disabled={candidate > division.registrationCount}
                >
                  {candidate}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-check-label">
            <input
              type="checkbox"
              checked={showThirdPlace}
              onChange={(event) =>
                setShowThirdPlace(event.currentTarget.checked)
              }
            />
            Матч за третье место
          </label>
          <button
            type="button"
            disabled={
              busy !== null ||
              division.registrationCount < 4 ||
              size > division.registrationCount
            }
            onClick={createBracket}
          >
            {busy === "create" ? (
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
            ) : (
              <Swords size={17} aria-hidden="true" />
            )}
            Создать
          </button>
          {division.registrationCount < 4 && (
            <small>Для минимальной сетки нужно не менее четырёх игроков.</small>
          )}
        </div>
      ) : bracket ? (
        <>
          <div className="admin-playoff-toolbar">
            <span className={bracket.isPublished ? "published" : ""}>
              {bracket.isPublished ? "Опубликована" : "Черновик сетки"}
            </span>
            <label className="admin-check-label">
              <input
                type="checkbox"
                checked={bracket.showThirdPlace}
                disabled={busy !== null || tournament.status === "COMPLETED"}
                onChange={(event) =>
                  void updateSettings(event.currentTarget.checked)
                }
              />
              Матч за третье место
            </label>
            <button
              type="button"
              disabled={busy !== null || tournament.status === "COMPLETED"}
              onClick={() => void setPublication(!bracket.isPublished)}
            >
              {busy === "publication" ? (
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
              ) : bracket.isPublished ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
              {bracket.isPublished ? "Скрыть" : "Опубликовать"}
            </button>
          </div>

          {bracket.warnings.length > 0 && (
            <div className="admin-playoff-warnings">
              <Settings2 size={17} aria-hidden="true" />
              <ul>
                {bracket.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="admin-bracket-scroll">
            <div
              className="admin-bracket"
              style={{
                gridTemplateColumns: `repeat(${bracket.rounds.length}, minmax(270px, 1fr))`,
              }}
            >
              {bracket.rounds.map((round) => (
                <section
                  className="admin-bracket-round"
                  key={round.roundNumber}
                >
                  <h4>{round.name}</h4>
                  <div className="admin-bracket-round-matches">
                    {round.matches.map((match) => (
                      <PlayoffMatchEditor
                        key={`${match.id}-${match.version}`}
                        match={match}
                        bracket={bracket}
                        disabled={
                          busy !== null || tournament.status === "COMPLETED"
                        }
                        saving={busy === match.id}
                        onSave={(values) => void saveMatch(match, values)}
                      />
                    ))}
                    {round.name === "Финал" &&
                      bracket.showThirdPlace &&
                      bracket.thirdPlaceMatch && (
                        <div className="admin-third-place">
                          <h5>Матч за третье место</h5>
                          <PlayoffMatchEditor
                            key={`${bracket.thirdPlaceMatch.id}-${bracket.thirdPlaceMatch.version}`}
                            match={bracket.thirdPlaceMatch}
                            bracket={bracket}
                            disabled={
                              busy !== null || tournament.status === "COMPLETED"
                            }
                            saving={busy === bracket.thirdPlaceMatch.id}
                            onSave={(values) =>
                              void saveMatch(bracket.thirdPlaceMatch!, values)
                            }
                          />
                        </div>
                      )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}

interface MatchEditorValues {
  participant1RegistrationId: string | null
  participant2RegistrationId: string | null
  score1: number | null
  score2: number | null
  winnerRegistrationId: string | null
}

function PlayoffMatchEditor({
  match,
  bracket,
  disabled,
  saving,
  onSave,
}: {
  match: PlayoffMatch
  bracket: AdminPlayoff
  disabled: boolean
  saving: boolean
  onSave: (values: MatchEditorValues) => void
}) {
  const [participant1, setParticipant1] = useState(
    match.participant1?.registrationId ?? ""
  )
  const [participant2, setParticipant2] = useState(
    match.participant2?.registrationId ?? ""
  )
  const [score1, setScore1] = useState(
    match.score1 === null ? "" : String(match.score1)
  )
  const [score2, setScore2] = useState(
    match.score2 === null ? "" : String(match.score2)
  )
  const [winner, setWinner] = useState(match.winnerRegistrationId ?? "")
  const participantsAutomatic =
    match.roundNumber > 1 || match.kind === "THIRD_PLACE"
  const selectedParticipants = useMemo(
    () =>
      bracket.registrations.filter(
        (registration) =>
          registration.registrationId === participant1 ||
          registration.registrationId === participant2
      ),
    [bracket.registrations, participant1, participant2]
  )
  const entrantIds = useMemo(
    () =>
      new Set(
        bracket.registrations.map((registration) => registration.registrationId)
      ),
    [bracket.registrations]
  )

  return (
    <article className="admin-playoff-match" data-status={match.status}>
      <span>Матч {match.position}</span>
      <div className="admin-match-columns" aria-hidden="true">
        <span>
          {participantsAutomatic ? "Участник из прошлого раунда" : "Игрок"}
        </span>
        <span>Счёт</span>
      </div>
      <div className="admin-match-player-row">
        {participantsAutomatic ? (
          <div className="admin-auto-player">
            {match.participant1?.nickname ?? "Ожидается результат"}
          </div>
        ) : (
          <select
            value={participant1}
            disabled={disabled}
            aria-label="Первый участник"
            onChange={(event) => {
              setParticipant1(event.currentTarget.value)
              if (
                winner &&
                winner !== event.currentTarget.value &&
                winner !== participant2
              ) {
                setWinner("")
              }
            }}
          >
            <option value="">Ожидается</option>
            {participant1 && !entrantIds.has(participant1) && (
              <option value={participant1} disabled>
                {match.participant1?.nickname ?? "Участник"} — вне top-N
              </option>
            )}
            {bracket.registrations.map((registration) => (
              <option
                key={registration.registrationId}
                value={registration.registrationId}
              >
                {registration.nickname} · {registration.qualificationPoints}{" "}
                очк.
              </option>
            ))}
          </select>
        )}
        <label className="admin-match-score">
          <span className="sr-only">Счёт первого участника</span>
          <input
            type="number"
            min={0}
            placeholder="0"
            value={score1}
            disabled={disabled || !participant1}
            aria-label="Счёт первого участника"
            onChange={(event) => setScore1(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="admin-match-player-row">
        {participantsAutomatic ? (
          <div className="admin-auto-player">
            {match.participant2?.nickname ?? "Ожидается результат"}
          </div>
        ) : (
          <select
            value={participant2}
            disabled={disabled}
            aria-label="Второй участник"
            onChange={(event) => {
              setParticipant2(event.currentTarget.value)
              if (
                winner &&
                winner !== participant1 &&
                winner !== event.currentTarget.value
              ) {
                setWinner("")
              }
            }}
          >
            <option value="">Ожидается</option>
            {participant2 && !entrantIds.has(participant2) && (
              <option value={participant2} disabled>
                {match.participant2?.nickname ?? "Участник"} — вне top-N
              </option>
            )}
            {bracket.registrations.map((registration) => (
              <option
                key={registration.registrationId}
                value={registration.registrationId}
              >
                {registration.nickname} · {registration.qualificationPoints}{" "}
                очк.
              </option>
            ))}
          </select>
        )}
        <label className="admin-match-score">
          <span className="sr-only">Счёт второго участника</span>
          <input
            type="number"
            min={0}
            placeholder="0"
            value={score2}
            disabled={disabled || !participant2}
            aria-label="Счёт второго участника"
            onChange={(event) => setScore2(event.currentTarget.value)}
          />
        </label>
      </div>
      <label>
        <span>Победитель</span>
        <select
          value={winner}
          disabled={disabled}
          onChange={(event) => setWinner(event.currentTarget.value)}
        >
          <option value="">Матч не завершён</option>
          {selectedParticipants.map((registration) => (
            <option
              key={registration.registrationId}
              value={registration.registrationId}
            >
              {registration.nickname}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onSave({
            participant1RegistrationId: participant1 || null,
            participant2RegistrationId: participant2 || null,
            score1: score1 === "" ? null : Number(score1),
            score2: score2 === "" ? null : Number(score2),
            winnerRegistrationId: winner || null,
          })
        }
      >
        {saving ? (
          <LoaderCircle className="spin" size={15} aria-hidden="true" />
        ) : (
          <Save size={15} aria-hidden="true" />
        )}
        Сохранить матч
      </button>
    </article>
  )
}

function messageFor(reason: unknown) {
  return reason instanceof ApiError
    ? reason.message
    : "Не удалось выполнить действие с сеткой."
}
