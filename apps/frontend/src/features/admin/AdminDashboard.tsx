import type {
  AdminAuditEntry,
  AdminOverview,
  AdminSession,
} from "@mcsr-sabinsk/shared"
import {
  Activity,
  FilePenLine,
  LoaderCircle,
  ShieldCheck,
  Trophy,
} from "lucide-react"
import { useEffect, useState } from "react"

import { ApiError, apiRequest } from "@/lib/api-client"

import { AdminShell } from "./AdminShell"

const AUDIT_LABELS: Record<string, string> = {
  AUTH_LOGIN_SUCCEEDED: "Вход выполнен",
  AUTH_LOGIN_FAILED: "Неудачная попытка входа",
  AUTH_LOGIN_LOCKED: "Вход временно заблокирован",
  AUTH_LOGIN_BLOCKED: "Отклонена попытка входа",
  AUTH_LOGOUT: "Выход выполнен",
  TOURNAMENT_CREATED: "Турнир создан",
  TOURNAMENT_UPDATED: "Турнир изменён",
  TOURNAMENT_STATUS_CHANGED: "Статус турнира изменён",
  TOURNAMENT_COVER_SET: "Обложка турнира установлена",
  TOURNAMENT_COVER_REMOVED: "Обложка турнира удалена",
  TOURNAMENT_DELETED: "Черновик турнира удалён",
  REGISTRATION_ADDED: "Участник добавлен",
  REGISTRATIONS_BULK_ADDED: "Добавлен список участников",
  REGISTRATION_MOVED: "Участник перемещён",
  REGISTRATION_REMOVED: "Участник удалён",
}

interface DashboardData {
  session: AdminSession
  overview: AdminOverview
}

function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(value))
}

function AuditRow({ entry }: { entry: AdminAuditEntry }) {
  return (
    <li className="admin-audit-row">
      <span className="admin-audit-mark" aria-hidden="true" />
      <span>
        <strong>{AUDIT_LABELS[entry.action] ?? entry.action}</strong>
        <small>
          {entry.adminUsername} · {formatAuditTime(entry.createdAt)}
        </small>
      </span>
    </li>
  )
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8_000)

    apiRequest<AdminSession>("/auth/me", controller.signal)
      .then(async (session) => ({
        session,
        overview: await apiRequest<AdminOverview>(
          "/admin/overview",
          controller.signal
        ),
      }))
      .then(setData)
      .catch((reason: unknown) => {
        const requestWasAborted =
          reason instanceof DOMException && reason.name === "AbortError"
        if (
          requestWasAborted ||
          (reason instanceof ApiError && reason.status === 401)
        ) {
          window.location.replace("/admin/login")
          return
        }
        setError(
          "Не удалось загрузить админ-панель. Проверьте, что backend запущен."
        )
      })
      .finally(() => window.clearTimeout(timeout))

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  if (error) {
    return (
      <div className="admin-state" role="alert">
        <ShieldCheck size={30} aria-hidden="true" />
        <h1>Админ-панель недоступна</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Повторить попытку
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="admin-state">
        <LoaderCircle className="spin" size={28} aria-hidden="true" />
        <p>Загружаем админ-панель…</p>
      </div>
    )
  }

  const { session, overview } = data
  return (
    <AdminShell session={session} active="overview">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Панель управления</p>
          <h1>Обзор</h1>
        </div>
        <a href="/">Открыть публичную страницу</a>
      </header>

      <section className="admin-stat-grid" aria-label="Сводка турниров">
        <article>
          <Trophy size={22} aria-hidden="true" />
          <span>Всего турниров</span>
          <strong>{overview.tournamentCount}</strong>
        </article>
        <article>
          <Activity size={22} aria-hidden="true" />
          <span>Идут сейчас</span>
          <strong>{overview.activeTournamentCount}</strong>
        </article>
        <article>
          <FilePenLine size={22} aria-hidden="true" />
          <span>Черновики</span>
          <strong>{overview.draftTournamentCount}</strong>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">Безопасность</p>
            <h2>Последние действия</h2>
          </div>
          <ShieldCheck size={24} aria-hidden="true" />
        </div>
        {overview.recentAudit.length === 0 ? (
          <p className="admin-empty">Действий пока нет.</p>
        ) : (
          <ul className="admin-audit-list">
            {overview.recentAudit.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  )
}
