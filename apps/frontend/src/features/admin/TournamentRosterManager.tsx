import type {
  AdminRegistration,
  AdminSession,
  AdminTournament,
  RegistrationMutationResult,
  RegistrationMoveResult,
  RegistrationPreview,
  RegistrationPreviewStatus,
} from "@mcsr-sabinsk/shared"
import {
  Check,
  LoaderCircle,
  LockKeyhole,
  Search,
  Trash2,
  UserRoundPlus,
  UsersRound,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { ApiError, apiCommand, apiRequest } from "@/lib/api-client"

interface TournamentRosterManagerProps {
  session: AdminSession
  tournament: AdminTournament
  onTournamentChanged: (tournament: AdminTournament) => void
}

const PREVIEW_LABELS: Record<RegistrationPreviewStatus, string> = {
  READY: "Готов",
  ALREADY_REGISTERED: "Уже добавлен",
  CONFLICT: "Конфликт",
  DUPLICATE_INPUT: "Повтор",
  NOT_FOUND: "Не найден",
  ERROR: "Ошибка API",
}

function parseIdentifiers(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((identifier) => identifier.trim())
    .filter(Boolean)
}

export function TournamentRosterManager({
  session,
  tournament,
  onTournamentChanged,
}: TournamentRosterManagerProps) {
  const [divisionId, setDivisionId] = useState(
    tournament.divisions[0]?.id ?? ""
  )
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([])
  const [identifiers, setIdentifiers] = useState("")
  const [preview, setPreview] = useState<RegistrationPreview | null>(null)
  const [loadingRoster, setLoadingRoster] = useState(true)
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
    const stillExists = tournament.divisions.some(
      (candidate) => candidate.id === divisionId
    )
    if (!stillExists) {
      setDivisionId(tournament.divisions[0]?.id ?? "")
    }
  }, [divisionId, tournament.divisions])

  useEffect(() => {
    if (!division) return
    const controller = new AbortController()
    setLoadingRoster(true)
    apiRequest<AdminRegistration[]>(
      `/admin/divisions/${division.id}/registrations`,
      controller.signal
    )
      .then(setRegistrations)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") {
          return
        }
        setError(
          reason instanceof ApiError
            ? reason.message
            : "Не удалось загрузить состав."
        )
      })
      .finally(() => setLoadingRoster(false))
    return () => controller.abort()
  }, [division?.id, division?.registrationCount])

  function selectDivision(id: string) {
    setDivisionId(id)
    setIdentifiers("")
    setPreview(null)
    setError(null)
    setNotice(null)
  }

  async function refreshTournament() {
    const fresh = await apiRequest<AdminTournament>(
      `/admin/tournaments/${tournament.id}`
    )
    onTournamentChanged(fresh)
  }

  async function checkIdentifiers() {
    if (!division) return
    const nicknames = parseIdentifiers(identifiers)
    if (nicknames.length === 0) {
      setError("Введите хотя бы один ник.")
      return
    }
    if (nicknames.length > 100) {
      setError("За один раз можно проверить не более 100 ников.")
      return
    }
    setBusy("preview")
    setError(null)
    setNotice(null)
    try {
      const result = await apiCommand<RegistrationPreview>(
        `/admin/divisions/${division.id}/registrations/preview`,
        {
          method: "POST",
          body: { nicknames },
          csrfToken: session.csrfToken,
        }
      )
      setPreview(result)
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Не удалось проверить список."
      )
    } finally {
      setBusy(null)
    }
  }

  async function applyReady() {
    if (!division || !preview) return
    const nicknames = preview.items
      .filter((item) => item.status === "READY")
      .map((item) => item.identifier)
    if (nicknames.length === 0) return

    setBusy("apply")
    setError(null)
    try {
      await apiCommand<RegistrationMutationResult>(
        `/admin/divisions/${division.id}/registrations/bulk`,
        {
          method: "POST",
          body: {
            nicknames,
            expectedDivisionVersion: division.version,
          },
          csrfToken: session.csrfToken,
        }
      )
      await refreshTournament()
      setIdentifiers("")
      setPreview(null)
      setNotice(
        nicknames.length === 1
          ? "Участник добавлен."
          : `Добавлено участников: ${nicknames.length}.`
      )
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Не удалось добавить участников."
      )
    } finally {
      setBusy(null)
    }
  }

  async function removeRegistration(registration: AdminRegistration) {
    if (!division) return
    if (
      !window.confirm(
        `Удалить ${registration.nicknameSnapshot} из дивизиона «${division.displayName}»?`
      )
    ) {
      return
    }
    setBusy(`remove-${registration.id}`)
    setError(null)
    try {
      await apiCommand<void>(`/admin/registrations/${registration.id}`, {
        method: "DELETE",
        body: {
          expectedRegistrationVersion: registration.version,
          expectedDivisionVersion: division.version,
        },
        csrfToken: session.csrfToken,
      })
      await refreshTournament()
      setNotice("Участник удалён.")
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Не удалось удалить участника."
      )
    } finally {
      setBusy(null)
    }
  }

  async function moveRegistration(
    registration: AdminRegistration,
    targetDivisionId: string
  ) {
    if (!division || targetDivisionId === division.id) return
    const target = tournament.divisions.find(
      (candidate) => candidate.id === targetDivisionId
    )
    if (!target) return
    if (
      !window.confirm(
        `Переместить ${registration.nicknameSnapshot} в дивизион «${target.displayName}»?`
      )
    ) {
      return
    }

    setBusy(`move-${registration.id}`)
    setError(null)
    try {
      await apiCommand<RegistrationMoveResult>(
        `/admin/registrations/${registration.id}`,
        {
          method: "PATCH",
          body: {
            targetDivisionId: target.id,
            expectedRegistrationVersion: registration.version,
            expectedSourceDivisionVersion: division.version,
            expectedTargetDivisionVersion: target.version,
          },
          csrfToken: session.csrfToken,
        }
      )
      await refreshTournament()
      setNotice(
        `${registration.nicknameSnapshot} перемещён в «${target.displayName}».`
      )
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Не удалось переместить участника."
      )
    } finally {
      setBusy(null)
    }
  }

  if (!division) return null

  const rosterReadOnly =
    division.rosterLocked ||
    tournament.status === "PLAYOFF" ||
    tournament.status === "COMPLETED"

  return (
    <section className="admin-roster">
      <div className="admin-roster-heading">
        <div>
          <p className="admin-kicker">Участники</p>
          <h3>Составы дивизионов</h3>
        </div>
        <UsersRound size={22} aria-hidden="true" />
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
            <span>{candidate.registrationCount}</span>
            {candidate.rosterLocked && (
              <LockKeyhole size={13} aria-label="Состав зафиксирован" />
            )}
          </button>
        ))}
      </div>

      {rosterReadOnly ? (
        <div className="admin-roster-lock">
          <LockKeyhole size={18} aria-hidden="true" />
          <span>
            {division.rosterLocked
              ? "Состав зафиксирован после первого импортированного матча."
              : "На текущем этапе турнира состав доступен только для просмотра."}
          </span>
        </div>
      ) : (
        <div className="admin-roster-add">
          <label>
            <span>Ники — по одному на строку</span>
            <textarea
              rows={4}
              value={identifiers}
              placeholder={"PlayerOne\nPlayerTwo"}
              onChange={(event) => {
                setIdentifiers(event.currentTarget.value)
                setPreview(null)
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy !== null}
            onClick={checkIdentifiers}
          >
            {busy === "preview" ? (
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
            ) : (
              <Search size={17} aria-hidden="true" />
            )}
            Проверить в Ranked
          </button>
        </div>
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

      {preview && (
        <div className="admin-roster-preview">
          <div className="admin-roster-preview-heading">
            <strong>Результат проверки</strong>
            <span>
              Готовы к добавлению: {preview.readyCount} из{" "}
              {preview.items.length}
            </span>
          </div>
          <ul>
            {preview.items.map((item, index) => (
              <li key={`${item.identifier}-${index}`}>
                {item.profile ? (
                  <img src={item.profile.avatarUrl} alt="" />
                ) : (
                  <span className="admin-avatar-placeholder">
                    <UserRoundPlus size={17} aria-hidden="true" />
                  </span>
                )}
                <span>
                  <strong>{item.profile?.nickname ?? item.identifier}</strong>
                  <small>
                    {item.profile?.uuid ?? item.message ?? "Нет данных"}
                  </small>
                </span>
                <em data-preview-status={item.status}>
                  {PREVIEW_LABELS[item.status]}
                </em>
              </li>
            ))}
          </ul>
          {preview.readyCount > 0 && !rosterReadOnly && (
            <button
              className="admin-primary-action"
              type="button"
              disabled={busy !== null}
              onClick={applyReady}
            >
              {busy === "apply" ? (
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
              ) : (
                <Check size={17} aria-hidden="true" />
              )}
              Добавить подтверждённых
            </button>
          )}
        </div>
      )}

      <div className="admin-roster-list">
        <div className="admin-roster-list-heading">
          <strong>Текущий состав</strong>
          <span>{registrations.length}</span>
        </div>
        {loadingRoster ? (
          <div className="admin-roster-loading">
            <LoaderCircle className="spin" size={20} aria-hidden="true" />
          </div>
        ) : registrations.length === 0 ? (
          <p className="admin-empty">В этом дивизионе пока нет участников.</p>
        ) : (
          <ul>
            {registrations.map((registration) => (
              <li key={registration.id}>
                <img src={registration.participant.avatarUrl} alt="" />
                <span>
                  <strong>{registration.nicknameSnapshot}</strong>
                  <small>{registration.participant.uuid}</small>
                </span>
                {registration.participant.eloRate !== null && (
                  <em>{registration.participant.eloRate} ELO</em>
                )}
                {!rosterReadOnly && (
                  <>
                    <select
                      value={division.id}
                      aria-label={`Дивизион участника ${registration.nicknameSnapshot}`}
                      disabled={busy !== null}
                      onChange={(event) =>
                        void moveRegistration(
                          registration,
                          event.currentTarget.value
                        )
                      }
                    >
                      {tournament.divisions.map((candidate) => (
                        <option
                          key={candidate.id}
                          value={candidate.id}
                          disabled={
                            candidate.id !== division.id &&
                            candidate.rosterLocked
                          }
                        >
                          {candidate.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Удалить ${registration.nicknameSnapshot}`}
                      disabled={busy !== null}
                      onClick={() => removeRegistration(registration)}
                    >
                      {busy === `remove-${registration.id}` ||
                      busy === `move-${registration.id}` ? (
                        <LoaderCircle
                          className="spin"
                          size={16}
                          aria-hidden="true"
                        />
                      ) : (
                        <Trash2 size={16} aria-hidden="true" />
                      )}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
