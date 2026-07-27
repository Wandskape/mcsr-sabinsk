import { zodResolver } from "@hookform/resolvers/zod"
import type {
  AdminSession,
  AdminTournament,
  CompletionReadiness,
  CoverUpload,
  TournamentStatus,
} from "@mcsr-sabinsk/shared"
import { TOURNAMENT_STATUS_LABELS } from "@mcsr-sabinsk/shared"
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  ApiError,
  apiCommand,
  apiFormCommand,
  apiRequest,
} from "@/lib/api-client"

import { AdminShell } from "./AdminShell"
import { TournamentQualificationManager } from "./TournamentQualificationManager"
import { TournamentPlayoffManager } from "./TournamentPlayoffManager"
import { TournamentRosterManager } from "./TournamentRosterManager"

const TournamentFormSchema = z
  .object({
    name: z.string().trim().min(1, "Введите название.").max(120),
    slug: z
      .string()
      .trim()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Используйте строчные латинские буквы, цифры и дефисы."
      )
      .max(140),
    description: z.string().trim().max(10_000),
    startsAt: z.string().min(1, "Укажите дату начала."),
    endsAt: z.string().min(1, "Укажите дату окончания."),
    beginnerMinutes: z.number().int().min(1).max(1_440),
    experiencedMinutes: z.number().int().min(1).max(1_440),
    proMinutes: z.number().int().min(1).max(1_440),
  })
  .refine((input) => input.startsAt < input.endsAt, {
    message: "Дата окончания должна быть позже даты начала.",
    path: ["endsAt"],
  })

type TournamentFormValues = z.infer<typeof TournamentFormSchema>

const DEFAULT_VALUES: TournamentFormValues = {
  name: "",
  slug: "",
  description: "",
  startsAt: "",
  endsAt: "",
  beginnerMinutes: 60,
  experiencedMinutes: 45,
  proMinutes: 30,
}

const NEXT_STATUS_ACTIONS: Partial<
  Record<TournamentStatus, Array<{ status: TournamentStatus; label: string }>>
> = {
  DRAFT: [{ status: "UPCOMING", label: "Опубликовать турнир" }],
  UPCOMING: [{ status: "QUALIFICATION", label: "Начать квалификацию" }],
  QUALIFICATION: [
    { status: "PLAYOFF", label: "Перейти к плей-офф" },
    { status: "COMPLETED", label: "Завершить без плей-офф" },
  ],
  PLAYOFF: [{ status: "COMPLETED", label: "Завершить турнир" }],
}

function dateTimeForInput(value: string) {
  const date = new Date(new Date(value).getTime() + 3 * 60 * 60 * 1_000)
  return (
    [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("-") +
    "T" +
    [
      String(date.getUTCHours()).padStart(2, "0"),
      String(date.getUTCMinutes()).padStart(2, "0"),
    ].join(":")
  )
}

function moscowInputToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) {
    throw new Error("Некорректные дата и время.")
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  return new Date(
    Date.UTC(year, month - 1, day, hour - 3, minute)
  ).toISOString()
}

function tournamentValues(tournament: AdminTournament): TournamentFormValues {
  const limit = (type: "BEGINNER" | "EXPERIENCED" | "PRO") =>
    Math.round(
      (tournament.divisions.find((division) => division.type === type)
        ?.timeLimitMs ?? 60_000) / 60_000
    )

  return {
    name: tournament.name,
    slug: tournament.slug,
    description: tournament.description,
    startsAt: dateTimeForInput(tournament.startsAt),
    endsAt: dateTimeForInput(tournament.endsAt),
    beginnerMinutes: limit("BEGINNER"),
    experiencedMinutes: limit("EXPERIENCED"),
    proMinutes: limit("PRO"),
  }
}

function displayDates(tournament: AdminTournament) {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Moscow",
  })
  return `${formatter.format(new Date(tournament.startsAt))} — ${formatter.format(
    new Date(tournament.endsAt)
  )}`
}

function slugify(value: string) {
  const transliteration: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  }
  return value
    .toLowerCase()
    .split("")
    .map((letter) => transliteration[letter] ?? letter)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function AdminTournamentsPage() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [tournaments, setTournaments] = useState<AdminTournament[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [completionReadiness, setCompletionReadiness] =
    useState<CompletionReadiness | null>(null)

  const selected = useMemo(
    () =>
      tournaments.find((tournament) => tournament.id === selectedId) ?? null,
    [selectedId, tournaments]
  )

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TournamentFormValues>({
    resolver: zodResolver(TournamentFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<AdminSession>("/auth/me", controller.signal),
      apiRequest<AdminTournament[]>("/admin/tournaments", controller.signal),
    ])
      .then(([loadedSession, loadedTournaments]) => {
        setSession(loadedSession)
        setTournaments(loadedTournaments)
        if (loadedTournaments[0]) {
          setSelectedId(loadedTournaments[0].id)
        } else {
          setIsCreating(true)
        }
      })
      .catch(handleLoadError)
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (isCreating) {
      reset(DEFAULT_VALUES)
    } else if (selected) {
      reset(tournamentValues(selected))
    }
  }, [isCreating, reset, selected])

  function handleLoadError(reason: unknown) {
    if (reason instanceof ApiError && reason.status === 401) {
      window.location.replace("/admin/login")
      return
    }
    setError(
      reason instanceof ApiError
        ? reason.message
        : "Не удалось загрузить турниры. Проверьте backend."
    )
  }

  function upsertTournament(tournament: AdminTournament) {
    setTournaments((current) => {
      const exists = current.some((item) => item.id === tournament.id)
      const next = exists
        ? current.map((item) => (item.id === tournament.id ? tournament : item))
        : [tournament, ...current]
      return next.sort(
        (left, right) =>
          new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime()
      )
    })
    setSelectedId(tournament.id)
    setIsCreating(false)
  }

  const save = handleSubmit(async (values) => {
    if (!session) return
    setError(null)
    setNotice(null)
    const payload = {
      name: values.name.trim(),
      slug: values.slug.trim(),
      description: values.description.trim(),
      startsAt: moscowInputToIso(values.startsAt),
      endsAt: moscowInputToIso(values.endsAt),
      divisionTimeLimitsMs: {
        BEGINNER: values.beginnerMinutes * 60_000,
        EXPERIENCED: values.experiencedMinutes * 60_000,
        PRO: values.proMinutes * 60_000,
      },
    }

    try {
      const tournament = isCreating
        ? await apiCommand<AdminTournament>("/admin/tournaments", {
            method: "POST",
            body: payload,
            csrfToken: session.csrfToken,
          })
        : await apiCommand<AdminTournament>(
            `/admin/tournaments/${selected?.id}`,
            {
              method: "PATCH",
              body: { ...payload, expectedVersion: selected?.version },
              csrfToken: session.csrfToken,
            }
          )
      upsertTournament(tournament)
      setNotice(isCreating ? "Турнир создан." : "Изменения сохранены.")
    } catch (reason) {
      handleLoadError(reason)
    }
  })

  async function changeStatus(status: TournamentStatus) {
    if (!session || !selected) return
    if (status === "COMPLETED") {
      setBusyAction("completion-readiness")
      setError(null)
      try {
        setCompletionReadiness(
          await apiRequest<CompletionReadiness>(
            `/admin/tournaments/${selected.id}/completion-readiness`
          )
        )
      } catch (reason) {
        handleLoadError(reason)
      } finally {
        setBusyAction(null)
      }
      return
    }

    const participatingDivisions =
      status === "QUALIFICATION"
        ? selected.divisions.filter(
            (division) => division.registrationCount > 0
          )
        : []
    const confirmation =
      status === "QUALIFICATION"
        ? participatingDivisions.length > 0
          ? `Начать квалификацию? В турнир войдут дивизионы: ${participatingDivisions
              .map((division) => division.displayName)
              .join(", ")}. Пустые дивизионы участвовать не будут.`
          : "Начать квалификацию нельзя: добавьте участников хотя бы в один дивизион."
        : `Перевести турнир в статус «${TOURNAMENT_STATUS_LABELS[status]}»?`

    if (status === "QUALIFICATION" && participatingDivisions.length === 0) {
      setError(confirmation)
      return
    }
    if (!window.confirm(confirmation)) {
      return
    }
    await applyStatusChange(status)
  }

  async function applyStatusChange(status: TournamentStatus) {
    if (!session || !selected) return
    setBusyAction(`status-${status}`)
    setError(null)
    try {
      const tournament = await apiCommand<AdminTournament>(
        `/admin/tournaments/${selected.id}/status`,
        {
          method: "POST",
          body: { status, expectedVersion: selected.version },
          csrfToken: session.csrfToken,
        }
      )
      upsertTournament(tournament)
      setCompletionReadiness(null)
      setNotice(`Статус: ${TOURNAMENT_STATUS_LABELS[status]}.`)
    } catch (reason) {
      handleLoadError(reason)
    } finally {
      setBusyAction(null)
    }
  }

  async function uploadCover(file: File) {
    if (!session || !selected) return
    setBusyAction("cover")
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const upload = await apiFormCommand<CoverUpload>(
        "/admin/media/cover-upload",
        formData,
        session.csrfToken
      )
      const tournament = await apiCommand<AdminTournament>(
        `/admin/tournaments/${selected.id}/cover`,
        {
          method: "POST",
          body: {
            objectKey: upload.objectKey,
            expectedVersion: selected.version,
          },
          csrfToken: session.csrfToken,
        }
      )
      upsertTournament(tournament)
      setNotice("Обложка загружена.")
    } catch (reason) {
      handleLoadError(reason)
    } finally {
      setBusyAction(null)
    }
  }

  async function removeCover() {
    if (!session || !selected) return
    setBusyAction("cover-remove")
    setError(null)
    try {
      const tournament = await apiCommand<AdminTournament>(
        `/admin/tournaments/${selected.id}/cover`,
        {
          method: "DELETE",
          body: { expectedVersion: selected.version },
          csrfToken: session.csrfToken,
        }
      )
      upsertTournament(tournament)
      setNotice("Обложка убрана.")
    } catch (reason) {
      handleLoadError(reason)
    } finally {
      setBusyAction(null)
    }
  }

  async function deleteDraft() {
    if (!session || !selected) return
    if (!window.confirm(`Удалить черновик «${selected.name}»?`)) return
    setBusyAction("delete")
    setError(null)
    try {
      await apiCommand<void>(`/admin/tournaments/${selected.id}`, {
        method: "DELETE",
        body: { expectedVersion: selected.version },
        csrfToken: session.csrfToken,
      })
      const remaining = tournaments.filter(
        (tournament) => tournament.id !== selected.id
      )
      setTournaments(remaining)
      setSelectedId(remaining[0]?.id ?? null)
      setIsCreating(remaining.length === 0)
      setNotice("Черновик удалён.")
    } catch (reason) {
      handleLoadError(reason)
    } finally {
      setBusyAction(null)
    }
  }

  if (loading || !session) {
    return (
      <div className="admin-state">
        <LoaderCircle className="spin" size={28} aria-hidden="true" />
        <p>Загружаем турниры…</p>
      </div>
    )
  }

  return (
    <AdminShell session={session} active="tournaments">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Управление</p>
          <h1>Турниры</h1>
        </div>
        <button
          className="admin-primary-action"
          type="button"
          onClick={() => {
            setIsCreating(true)
            setSelectedId(null)
            setCompletionReadiness(null)
            setError(null)
            setNotice(null)
          }}
        >
          <Plus size={18} aria-hidden="true" />
          Новый турнир
        </button>
      </header>

      {error && (
        <div className="admin-alert admin-alert-error" role="alert">
          <ShieldCheck size={18} aria-hidden="true" />
          {error}
        </div>
      )}
      {notice && (
        <div className="admin-alert admin-alert-success" role="status">
          {notice}
        </div>
      )}

      <div className="admin-tournament-layout">
        <aside className="admin-tournament-list" aria-label="Список турниров">
          {tournaments.length === 0 ? (
            <p className="admin-empty">
              Турниров пока нет. Создайте первый черновик.
            </p>
          ) : (
            tournaments.map((tournament) => (
              <button
                className={
                  !isCreating && tournament.id === selectedId ? "active" : ""
                }
                key={tournament.id}
                type="button"
                onClick={() => {
                  setSelectedId(tournament.id)
                  setIsCreating(false)
                  setCompletionReadiness(null)
                  setError(null)
                  setNotice(null)
                }}
              >
                <span>
                  <strong>{tournament.name}</strong>
                  <small>{displayDates(tournament)}</small>
                </span>
                <em data-status={tournament.status}>
                  {TOURNAMENT_STATUS_LABELS[tournament.status]}
                </em>
              </button>
            ))
          )}
        </aside>

        <section className="admin-panel admin-tournament-editor">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-kicker">
                {isCreating ? "Новый черновик" : "Редактирование"}
              </p>
              <h2>{isCreating ? "Создать турнир" : selected?.name}</h2>
            </div>
            <CalendarDays size={24} aria-hidden="true" />
          </div>

          <form className="admin-tournament-form" onSubmit={save}>
            <div className="admin-form-grid">
              <label>
                <span>Название</span>
                <input
                  {...register("name")}
                  onBlur={(event) => {
                    if (isCreating) {
                      setValue("slug", slugify(event.currentTarget.value), {
                        shouldValidate: true,
                      })
                    }
                  }}
                  placeholder="Кубок Сабинска #1"
                />
                {errors.name && <small>{errors.name.message}</small>}
              </label>
              <label>
                <span>Slug</span>
                <input
                  {...register("slug")}
                  disabled={!isCreating && selected?.status !== "DRAFT"}
                  placeholder="kubok-sabinska-1"
                />
                {errors.slug && <small>{errors.slug.message}</small>}
              </label>
              <label>
                <span>Начало, МСК</span>
                <input type="datetime-local" {...register("startsAt")} />
                {errors.startsAt && <small>{errors.startsAt.message}</small>}
              </label>
              <label>
                <span>Окончание, МСК</span>
                <input type="datetime-local" {...register("endsAt")} />
                {errors.endsAt && <small>{errors.endsAt.message}</small>}
              </label>
            </div>

            <label>
              <span>Описание</span>
              <textarea
                {...register("description")}
                rows={5}
                placeholder="Кратко расскажите об условиях турнира."
              />
              {errors.description && (
                <small>{errors.description.message}</small>
              )}
            </label>

            <fieldset>
              <legend>Лимиты времени квалификации</legend>
              <div className="admin-form-grid admin-limit-grid">
                <label>
                  <span>Новички, минут</span>
                  <input
                    type="number"
                    min={1}
                    max={1_440}
                    {...register("beginnerMinutes", { valueAsNumber: true })}
                  />
                </label>
                <label>
                  <span>Опытные, минут</span>
                  <input
                    type="number"
                    min={1}
                    max={1_440}
                    {...register("experiencedMinutes", {
                      valueAsNumber: true,
                    })}
                  />
                </label>
                <label>
                  <span>Про, минут</span>
                  <input
                    type="number"
                    min={1}
                    max={1_440}
                    {...register("proMinutes", { valueAsNumber: true })}
                  />
                </label>
              </div>
            </fieldset>

            <div className="admin-form-actions">
              <button
                className="admin-primary-action"
                disabled={isSubmitting || selected?.status === "COMPLETED"}
                type="submit"
              >
                {isSubmitting ? (
                  <LoaderCircle className="spin" size={18} aria-hidden="true" />
                ) : (
                  <Save size={18} aria-hidden="true" />
                )}
                {isCreating ? "Создать черновик" : "Сохранить"}
              </button>
            </div>
          </form>

          {!isCreating && selected && (
            <>
              <section className="admin-editor-section">
                <div>
                  <h3>Обложка</h3>
                  <p>JPEG, PNG или WebP, не более 5 МБ.</p>
                </div>
                {selected.coverUrl ? (
                  <div className="admin-cover-preview">
                    <img src={selected.coverUrl} alt="" />
                    <div className="admin-inline-actions">
                      <label className="admin-file-action">
                        <ImagePlus size={16} aria-hidden="true" />
                        Заменить
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={busyAction !== null}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0]
                            if (file) void uploadCover(file)
                            event.currentTarget.value = ""
                          }}
                        />
                      </label>
                      {selected.status === "DRAFT" && (
                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={removeCover}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          Убрать
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <label className="admin-file-action">
                    {busyAction === "cover" ? (
                      <LoaderCircle
                        className="spin"
                        size={18}
                        aria-hidden="true"
                      />
                    ) : (
                      <ImagePlus size={18} aria-hidden="true" />
                    )}
                    Загрузить обложку
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busyAction !== null}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0]
                        if (file) void uploadCover(file)
                        event.currentTarget.value = ""
                      }}
                    />
                  </label>
                )}
              </section>

              <section className="admin-editor-section">
                <div>
                  <h3>Статус турнира</h3>
                  <p>
                    Сейчас:{" "}
                    <strong>{TOURNAMENT_STATUS_LABELS[selected.status]}</strong>
                  </p>
                </div>
                <div className="admin-inline-actions">
                  {(NEXT_STATUS_ACTIONS[selected.status] ?? []).map(
                    (action) => (
                      <button
                        key={action.status}
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => changeStatus(action.status)}
                      >
                        {busyAction === `status-${action.status}` ||
                        (action.status === "COMPLETED" &&
                          busyAction === "completion-readiness") ? (
                          <LoaderCircle
                            className="spin"
                            size={17}
                            aria-hidden="true"
                          />
                        ) : (
                          <Upload size={17} aria-hidden="true" />
                        )}
                        {action.label}
                      </button>
                    )
                  )}
                </div>
              </section>

              <TournamentRosterManager
                session={session}
                tournament={selected}
                onTournamentChanged={upsertTournament}
              />

              <TournamentQualificationManager
                session={session}
                tournament={selected}
                onTournamentChanged={upsertTournament}
              />

              <TournamentPlayoffManager
                session={session}
                tournament={selected}
                onTournamentChanged={upsertTournament}
              />

              {selected.status === "DRAFT" &&
                !selected.coverObjectKey &&
                selected.divisions.every(
                  (division) =>
                    division.registrationCount === 0 &&
                    division.qualificationMatchCount === 0
                ) && (
                  <section className="admin-danger-zone">
                    <div>
                      <h3>Удалить черновик</h3>
                      <p>Это действие нельзя отменить.</p>
                    </div>
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={deleteDraft}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                      Удалить
                    </button>
                  </section>
                )}
            </>
          )}
        </section>
      </div>
      {completionReadiness && selected && (
        <div
          className="admin-completion-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setCompletionReadiness(null)
            }
          }}
        >
          <section
            className="admin-completion-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="completion-title"
          >
            <div className="admin-panel-heading">
              <div>
                <p className="admin-kicker">Финальная проверка</p>
                <h2 id="completion-title">Завершить «{selected.name}»?</h2>
              </div>
              {completionReadiness.canComplete ? (
                <CheckCircle2
                  className="admin-completion-ok"
                  size={28}
                  aria-hidden="true"
                />
              ) : (
                <CircleAlert
                  className="admin-completion-blocked"
                  size={28}
                  aria-hidden="true"
                />
              )}
            </div>
            <p className="admin-completion-intro">
              После завершения турнир станет историческим и обычное
              редактирование будет заблокировано.
            </p>
            <ul className="admin-completion-checks">
              {completionReadiness.checks.map((check) => (
                <li
                  key={check.code}
                  data-result={
                    check.passed
                      ? "passed"
                      : check.blocking
                        ? "blocked"
                        : "warn"
                  }
                >
                  {check.passed ? (
                    <CheckCircle2 size={19} aria-hidden="true" />
                  ) : (
                    <CircleAlert size={19} aria-hidden="true" />
                  )}
                  <span>
                    <strong>{check.label}</strong>
                    <small>{check.details}</small>
                  </span>
                </li>
              ))}
            </ul>
            <div className="admin-completion-actions">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => setCompletionReadiness(null)}
              >
                Отмена
              </button>
              <button
                className="admin-primary-action"
                type="button"
                disabled={
                  !completionReadiness.canComplete || busyAction !== null
                }
                onClick={() => void applyStatusChange("COMPLETED")}
              >
                {busyAction === "status-COMPLETED" ? (
                  <LoaderCircle className="spin" size={18} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={18} aria-hidden="true" />
                )}
                Подтвердить завершение
              </button>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  )
}
