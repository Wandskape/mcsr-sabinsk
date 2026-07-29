import type {
  AdminAnalytics,
  AdminSession,
  AnalyticsPeriod,
} from "@mcsr-sabinsk/shared"
import {
  BarChart3,
  Eye,
  LoaderCircle,
  Swords,
  Trophy,
  UserRound,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { ApiError, apiRequest } from "@/lib/api-client"

import { AdminShell } from "./AdminShell"

const PERIODS: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: "TODAY", label: "Сегодня" },
  { value: "7_DAYS", label: "7 дней" },
  { value: "30_DAYS", label: "30 дней" },
  { value: "ALL_TIME", label: "Всё время" },
]

function formatDay(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`))
}

export function AdminStatisticsPage() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [period, setPeriod] = useState<AnalyticsPeriod>("7_DAYS")
  const [statistics, setStatistics] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<AdminSession>("/auth/me", controller.signal),
      apiRequest<AdminAnalytics>(
        `/admin/analytics?period=${period}`,
        controller.signal
      ),
    ])
      .then(([loadedSession, loadedStatistics]) => {
        setSession(loadedSession)
        setStatistics(loadedStatistics)
      })
      .catch(handleError)
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  function handleError(reason: unknown) {
    if (reason instanceof ApiError && reason.status === 401) {
      window.location.replace("/admin/login")
      return
    }
    if (reason instanceof DOMException && reason.name === "AbortError") return
    setError(
      reason instanceof ApiError
        ? reason.message
        : "Не удалось загрузить статистику."
    )
  }

  async function selectPeriod(nextPeriod: AnalyticsPeriod) {
    setPeriod(nextPeriod)
    setLoading(true)
    setError(null)
    try {
      setStatistics(
        await apiRequest<AdminAnalytics>(
          `/admin/analytics?period=${nextPeriod}`
        )
      )
    } catch (reason) {
      handleError(reason)
    } finally {
      setLoading(false)
    }
  }

  const chartMaximum = useMemo(
    () =>
      Math.max(
        1,
        ...(statistics?.series.map(
          (point) =>
            point.tournamentViews + point.participantViews + point.matchViews
        ) ?? [])
      ),
    [statistics]
  )

  if (!session) {
    return (
      <div className="admin-state">
        <LoaderCircle className="spin" size={28} aria-hidden="true" />
        <p>Загружаем статистику…</p>
      </div>
    )
  }

  const totals = statistics?.totals ?? {
    tournamentViews: 0,
    participantViews: 0,
    matchViews: 0,
  }

  return (
    <AdminShell session={session} active="statistics">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Просмотры</p>
          <h1>Статистика</h1>
        </div>
        <BarChart3 size={28} aria-hidden="true" />
      </header>

      {error && (
        <div className="admin-alert admin-alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="admin-statistics-periods" aria-label="Период статистики">
        {PERIODS.map((item) => (
          <button
            className={period === item.value ? "active" : ""}
            type="button"
            key={item.value}
            disabled={loading}
            onClick={() => void selectPeriod(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="admin-statistics-cards">
        <article>
          <Trophy size={21} aria-hidden="true" />
          <span>Просмотры турниров</span>
          <strong>{totals.tournamentViews.toLocaleString("ru-RU")}</strong>
        </article>
        <article>
          <UserRound size={21} aria-hidden="true" />
          <span>Просмотры участников</span>
          <strong>{totals.participantViews.toLocaleString("ru-RU")}</strong>
        </article>
        <article>
          <Swords size={21} aria-hidden="true" />
          <span>Просмотры матчей</span>
          <strong>{totals.matchViews.toLocaleString("ru-RU")}</strong>
        </article>
      </section>

      <section className="admin-panel admin-statistics-chart-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">Динамика</p>
            <h2>Просмотры по дням</h2>
          </div>
          {loading ? (
            <LoaderCircle className="spin" size={22} aria-hidden="true" />
          ) : (
            <Eye size={22} aria-hidden="true" />
          )}
        </div>
        <div className="admin-statistics-legend">
          <span data-type="tournament">Турниры</span>
          <span data-type="participant">Участники</span>
          <span data-type="match">Матчи</span>
        </div>
        <div className="admin-statistics-chart-scroll">
          <div
            className="admin-statistics-chart"
            style={{
              gridTemplateColumns: `repeat(${Math.max(
                statistics?.series.length ?? 0,
                1
              )}, minmax(2.4rem, 1fr))`,
            }}
          >
            {statistics?.series.map((point) => {
              const total =
                point.tournamentViews +
                point.participantViews +
                point.matchViews
              return (
                <div className="admin-statistics-day" key={point.date}>
                  <div
                    className="admin-statistics-bar"
                    title={`${point.date}: турниры — ${point.tournamentViews}, участники — ${point.participantViews}, матчи — ${point.matchViews}`}
                    style={{ height: `${(total / chartMaximum) * 100}%` }}
                  >
                    <span
                      data-type="match"
                      style={{
                        flexGrow: point.matchViews,
                      }}
                    />
                    <span
                      data-type="participant"
                      style={{
                        flexGrow: point.participantViews,
                      }}
                    />
                    <span
                      data-type="tournament"
                      style={{
                        flexGrow: point.tournamentViews,
                      }}
                    />
                  </div>
                  <small>{formatDay(point.date)}</small>
                </div>
              )
            })}
          </div>
        </div>
        <p className="admin-statistics-note">
          Сохраняются только обезличенные просмотры. Сырые события удаляются
          через {statistics?.rawEventRetentionDays ?? 180} дней.
        </p>
      </section>
    </AdminShell>
  )
}
