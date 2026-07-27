import type {
  AdminQualificationMatch,
  AdminSession,
  AdminTournament,
  QualificationImportApplied,
  QualificationImportPreview,
  QualificationResultStatus,
} from "@mcsr-sabinsk/shared"
import {
  Check,
  LoaderCircle,
  RefreshCw,
  Search,
  Swords,
  Trophy,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { ApiError, apiCommand, apiRequest } from "@/lib/api-client"
import { formatDuration } from "@/lib/format"

interface TournamentQualificationManagerProps {
  session: AdminSession
  tournament: AdminTournament
  onTournamentChanged: (tournament: AdminTournament) => void
}

interface PreviewTarget {
  kind: "new" | "reimport"
  match: AdminQualificationMatch | null
}

const RESULT_LABELS: Record<QualificationResultStatus, string> = {
  COMPLETED: "Финиш",
  DNF: "DNF",
  MISSED: "Не участвовал",
}

function formatPlayedAt(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(value))
}

export function TournamentQualificationManager({
  session,
  tournament,
  onTournamentChanged,
}: TournamentQualificationManagerProps) {
  const [divisionId, setDivisionId] = useState(
    tournament.divisions[0]?.id ?? ""
  )
  const [matches, setMatches] = useState<AdminQualificationMatch[]>([])
  const [rankedMatchId, setRankedMatchId] = useState("")
  const [preview, setPreview] = useState<QualificationImportPreview | null>(
    null
  )
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)
  const [correctionReason, setCorrectionReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const division = useMemo(
    () =>
      tournament.divisions.find((candidate) => candidate.id === divisionId) ??
      tournament.divisions[0],
    [divisionId, tournament.divisions]
  )

  useEffect(() => {
    if (
      !tournament.divisions.some((candidate) => candidate.id === divisionId)
    ) {
      setDivisionId(tournament.divisions[0]?.id ?? "")
    }
  }, [divisionId, tournament.divisions])

  useEffect(() => {
    if (!division) return
    const controller = new AbortController()
    setLoading(true)
    apiRequest<AdminQualificationMatch[]>(
      `/admin/divisions/${division.id}/qualification-matches`,
      controller.signal
    )
      .then(setMatches)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") {
          return
        }
        setError(
          reason instanceof ApiError
            ? reason.message
            : "Не удалось загрузить квалификационные матчи."
        )
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [division?.id, division?.qualificationMatchCount, refreshKey])

  function selectDivision(id: string) {
    setDivisionId(id)
    setRankedMatchId("")
    setPreview(null)
    setPreviewTarget(null)
    setCorrectionReason("")
    setError(null)
    setNotice(null)
  }

  async function refreshTournament() {
    const fresh = await apiRequest<AdminTournament>(
      `/admin/tournaments/${tournament.id}`
    )
    onTournamentChanged(fresh)
    setRefreshKey((current) => current + 1)
  }

  async function previewNew() {
    if (!division) return
    const normalizedMatchId = rankedMatchId.trim()
    if (!normalizedMatchId) {
      setError("Введите match_id из MCSR Ranked.")
      return
    }

    setBusy("preview-new")
    setError(null)
    setNotice(null)
    try {
      const result = await apiCommand<QualificationImportPreview>(
        `/admin/divisions/${division.id}/qualification-matches/import-preview`,
        {
          method: "POST",
          body: { rankedMatchId: normalizedMatchId },
          csrfToken: session.csrfToken,
        }
      )
      setPreview(result)
      setPreviewTarget({ kind: "new", match: null })
      setCorrectionReason("")
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Не удалось получить матч из MCSR Ranked."
      )
    } finally {
      setBusy(null)
    }
  }

  async function previewReimport(match: AdminQualificationMatch) {
    setBusy(`preview-${match.id}`)
    setError(null)
    setNotice(null)
    try {
      const result = await apiCommand<QualificationImportPreview>(
        `/admin/qualification-matches/${match.id}/reimport-preview`,
        {
          method: "POST",
          csrfToken: session.csrfToken,
        }
      )
      setPreview(result)
      setPreviewTarget({ kind: "reimport", match })
      setCorrectionReason("")
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Не удалось проверить новую версию матча."
      )
    } finally {
      setBusy(null)
    }
  }

  async function applyPreview() {
    if (!division || !preview || !previewTarget) return
    if (
      previewTarget.kind === "reimport" &&
      tournament.status === "COMPLETED" &&
      correctionReason.trim().length < 10
    ) {
      setError("Для исправления завершённого турнира укажите причину.")
      return
    }

    setBusy("apply")
    setError(null)
    try {
      let result: QualificationImportApplied
      if (previewTarget.kind === "new") {
        result = await apiCommand<QualificationImportApplied>(
          `/admin/divisions/${division.id}/qualification-matches/import`,
          {
            method: "POST",
            body: {
              rankedMatchId: preview.rankedMatchId,
              previewToken: preview.previewToken,
              expectedDivisionVersion: division.version,
            },
            csrfToken: session.csrfToken,
          }
        )
      } else {
        const match = previewTarget.match
        if (!match) return
        const completed = tournament.status === "COMPLETED"
        result = await apiCommand<QualificationImportApplied>(
          `/admin/qualification-matches/${match.id}/${
            completed ? "completed-correction" : "reimport"
          }`,
          {
            method: "POST",
            body: {
              previewToken: preview.previewToken,
              expectedMatchVersion: match.version,
              ...(completed
                ? {
                    confirm: true,
                    reason: correctionReason.trim(),
                  }
                : {}),
            },
            csrfToken: session.csrfToken,
          }
        )
      }

      await refreshTournament()
      setRankedMatchId("")
      setPreview(null)
      setPreviewTarget(null)
      setCorrectionReason("")
      setNotice(
        result.changed
          ? `Матч #${result.match.matchNumber} сохранён. Лидерборд пересчитан.`
          : "Данные Ranked не изменились — новая версия не создана."
      )
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Не удалось сохранить результаты матча."
      )
    } finally {
      setBusy(null)
    }
  }

  if (!division) return null

  const canImport =
    tournament.status === "QUALIFICATION" && division.isParticipating
  const canReimport =
    tournament.status === "QUALIFICATION" || tournament.status === "COMPLETED"

  return (
    <section className="admin-qualification">
      <div className="admin-qualification-heading">
        <div>
          <p className="admin-kicker">Результаты</p>
          <h3>Квалификационные матчи</h3>
        </div>
        <Swords size={22} aria-hidden="true" />
      </div>

      <div className="admin-roster-tabs" role="tablist">
        {tournament.divisions.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={candidate.id === division.id ? "active" : ""}
            role="tab"
            aria-selected={candidate.id === division.id}
            onClick={() => selectDivision(candidate.id)}
          >
            {candidate.displayName}
            <span>{candidate.qualificationMatchCount}</span>
          </button>
        ))}
      </div>

      {canImport ? (
        <div className="admin-qualification-import">
          <label>
            <span>match_id из MCSR Ranked</span>
            <input
              value={rankedMatchId}
              placeholder="Например, 123456"
              onChange={(event) => {
                setRankedMatchId(event.currentTarget.value)
                setPreview(null)
                setPreviewTarget(null)
              }}
            />
          </label>
          <button type="button" disabled={busy !== null} onClick={previewNew}>
            {busy === "preview-new" ? (
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
            ) : (
              <Search size={17} aria-hidden="true" />
            )}
            Получить и проверить
          </button>
        </div>
      ) : (
        <p className="admin-qualification-hint">
          {!division.isParticipating &&
          tournament.status !== "DRAFT" &&
          tournament.status !== "UPCOMING"
            ? "Этот дивизион был пустым на момент старта и не участвует в турнире."
            : "Новые матчи можно импортировать, когда турнир находится на этапе «Квалификация»."}
        </p>
      )}

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

      {preview && previewTarget && (
        <div className="admin-qualification-preview">
          <div className="admin-qualification-preview-heading">
            <div>
              <strong>Предпросмотр Ranked-матча {preview.rankedMatchId}</strong>
              <span>
                {formatPlayedAt(preview.playedAt)} · участников дивизиона в
                матче: {preview.participantCount}
              </span>
            </div>
            <em data-changed={preview.changed}>
              {previewTarget.kind === "new"
                ? "Новый матч"
                : preview.changed
                  ? "Есть изменения"
                  : "Без изменений"}
            </em>
          </div>

          {preview.warnings.length > 0 && (
            <ul className="admin-qualification-warnings">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <div className="admin-qualification-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Место</th>
                  <th>Участник</th>
                  <th>Результат</th>
                  <th>Время</th>
                  <th>Очки</th>
                </tr>
              </thead>
              <tbody>
                {preview.results.map((result) => (
                  <tr key={result.registrationId}>
                    <td>{result.placement ?? "—"}</td>
                    <td>{result.nickname}</td>
                    <td>
                      <span data-result-status={result.status}>
                        {RESULT_LABELS[result.status]}
                      </span>
                    </td>
                    <td>
                      {formatDuration(
                        result.status === "COMPLETED"
                          ? result.rawTimeMs
                          : result.effectiveTimeMs
                      )}
                    </td>
                    <td>+{result.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.ignoredPlayers.length > 0 && (
            <p className="admin-qualification-ignored">
              Проигнорированы:{" "}
              {preview.ignoredPlayers
                .map((player) => player.nickname)
                .join(", ")}
            </p>
          )}

          {previewTarget.kind === "reimport" &&
            tournament.status === "COMPLETED" &&
            preview.changed && (
              <label className="admin-qualification-reason">
                <span>Причина исправления завершённого турнира</span>
                <textarea
                  rows={3}
                  value={correctionReason}
                  placeholder="Не менее 10 символов; причина попадёт в журнал аудита"
                  onChange={(event) =>
                    setCorrectionReason(event.currentTarget.value)
                  }
                />
              </label>
            )}

          {(previewTarget.kind === "new" || preview.changed) && (
            <button
              className="admin-primary-action"
              type="button"
              disabled={busy !== null}
              onClick={applyPreview}
            >
              {busy === "apply" ? (
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
              ) : (
                <Check size={17} aria-hidden="true" />
              )}
              Подтвердить и пересчитать лидерборд
            </button>
          )}
        </div>
      )}

      <div className="admin-qualification-matches">
        <div className="admin-qualification-list-heading">
          <strong>Сохранённые матчи</strong>
          <span>{matches.length}</span>
        </div>
        {loading ? (
          <div className="admin-roster-loading">
            <LoaderCircle className="spin" size={20} aria-hidden="true" />
          </div>
        ) : matches.length === 0 ? (
          <p className="admin-empty">
            В этом дивизионе пока нет импортированных матчей.
          </p>
        ) : (
          <ul>
            {matches.map((match) => (
              <li key={match.id}>
                <span className="admin-qualification-match-number">
                  #{match.matchNumber}
                </span>
                <span>
                  <strong>Ranked {match.rankedMatchId}</strong>
                  <small>
                    {match.playedAt ? formatPlayedAt(match.playedAt) : "—"} ·
                    версия {match.importVersion}
                  </small>
                </span>
                <span className="admin-qualification-counts">
                  <em>{match.resultCounts.COMPLETED} финишей</em>
                  <em>{match.resultCounts.DNF} DNF</em>
                  <em>{match.resultCounts.MISSED} пропусков</em>
                </span>
                {match.winner && (
                  <span className="admin-qualification-winner">
                    <Trophy size={14} aria-hidden="true" />
                    {match.winner.nickname}
                  </span>
                )}
                {canReimport && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => previewReimport(match)}
                  >
                    {busy === `preview-${match.id}` ? (
                      <LoaderCircle
                        className="spin"
                        size={16}
                        aria-hidden="true"
                      />
                    ) : (
                      <RefreshCw size={16} aria-hidden="true" />
                    )}
                    Проверить заново
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
