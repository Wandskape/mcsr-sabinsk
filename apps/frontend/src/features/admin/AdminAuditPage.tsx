import type {
  AdminAuditDetails,
  AdminAuditEntry,
  AdminAuditPage as AdminAuditPageData,
  AdminSession,
} from "@mcsr-sabinsk/shared"
import {
  ChevronRight,
  Filter,
  LoaderCircle,
  RefreshCw,
  ScrollText,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState, type SyntheticEvent } from "react"

import { ApiError, apiRequest } from "@/lib/api-client"

import { AdminShell } from "./AdminShell"
import { auditDiffRows } from "./audit-diff"
import { auditActionLabel, formatAuditTime } from "./audit-presentation"

interface AuditFilters {
  action: string
  entityType: string
  entityId: string
  adminUsername: string
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: AuditFilters = {
  action: "",
  entityType: "",
  entityId: "",
  adminUsername: "",
  dateFrom: "",
  dateTo: "",
}

export function AdminAuditPage() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] =
    useState<AuditFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState<AdminAuditPageData>({
    items: [],
    nextCursor: null,
  })
  const [details, setDetails] = useState<AdminAuditDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<AdminSession>("/auth/me", controller.signal),
      requestAuditPage(EMPTY_FILTERS, null, controller.signal),
    ])
      .then(([loadedSession, loadedPage]) => {
        setSession(loadedSession)
        setPage(loadedPage)
      })
      .catch(handleLoadError)
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  function handleLoadError(reason: unknown) {
    if (reason instanceof ApiError && reason.status === 401) {
      window.location.replace("/admin/login")
      return
    }
    if (reason instanceof DOMException && reason.name === "AbortError") return
    setError(
      reason instanceof ApiError
        ? reason.message
        : "Не удалось загрузить журнал аудита."
    )
  }

  async function applyFilters(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setDetails(null)
    try {
      const loaded = await requestAuditPage(filters, null)
      setAppliedFilters(filters)
      setPage(loaded)
    } catch (reason) {
      handleLoadError(reason)
    } finally {
      setLoading(false)
    }
  }

  async function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setDetails(null)
    setLoading(true)
    setError(null)
    try {
      setPage(await requestAuditPage(EMPTY_FILTERS, null))
    } catch (reason) {
      handleLoadError(reason)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (!page.nextCursor) return
    setLoadingMore(true)
    try {
      const next = await requestAuditPage(appliedFilters, page.nextCursor)
      setPage({
        items: [...page.items, ...next.items],
        nextCursor: next.nextCursor,
      })
    } catch (reason) {
      handleLoadError(reason)
    } finally {
      setLoadingMore(false)
    }
  }

  async function selectEntry(entry: AdminAuditEntry) {
    setDetailsLoading(true)
    setError(null)
    try {
      setDetails(
        await apiRequest<AdminAuditDetails>(`/admin/audit-logs/${entry.id}`)
      )
    } catch (reason) {
      handleLoadError(reason)
    } finally {
      setDetailsLoading(false)
    }
  }

  if (loading && !session) {
    return (
      <div className="admin-state">
        <LoaderCircle className="spin" size={28} aria-hidden="true" />
        <p>Загружаем журнал аудита…</p>
      </div>
    )
  }

  if (!session) return null

  return (
    <AdminShell session={session} active="audit">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">История изменений</p>
          <h1>Журнал аудита</h1>
        </div>
        <ScrollText size={26} aria-hidden="true" />
      </header>

      {error && (
        <div className="admin-alert admin-alert-error" role="alert">
          {error}
        </div>
      )}

      <form className="admin-audit-filters" onSubmit={applyFilters}>
        <label>
          <span>Действие</span>
          <input
            value={filters.action}
            placeholder="PLAYOFF_MATCH_UPDATED"
            onChange={(event) =>
              setFilters({ ...filters, action: event.currentTarget.value })
            }
          />
        </label>
        <label>
          <span>Тип сущности</span>
          <input
            value={filters.entityType}
            placeholder="Tournament"
            onChange={(event) =>
              setFilters({ ...filters, entityType: event.currentTarget.value })
            }
          />
        </label>
        <label>
          <span>ID сущности</span>
          <input
            value={filters.entityId}
            onChange={(event) =>
              setFilters({ ...filters, entityId: event.currentTarget.value })
            }
          />
        </label>
        <label>
          <span>Администратор</span>
          <input
            value={filters.adminUsername}
            onChange={(event) =>
              setFilters({
                ...filters,
                adminUsername: event.currentTarget.value,
              })
            }
          />
        </label>
        <label>
          <span>Дата с</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              setFilters({ ...filters, dateFrom: event.currentTarget.value })
            }
          />
        </label>
        <label>
          <span>Дата по</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilters({ ...filters, dateTo: event.currentTarget.value })
            }
          />
        </label>
        <div className="admin-audit-filter-actions">
          <button className="admin-primary-action" type="submit">
            <Filter size={16} aria-hidden="true" />
            Применить
          </button>
          <button type="button" onClick={clearFilters}>
            <RefreshCw size={16} aria-hidden="true" />
            Сбросить
          </button>
        </div>
      </form>

      <div className="admin-audit-layout">
        <section className="admin-panel admin-audit-full-list">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-kicker">Записи</p>
              <h2>{page.items.length}</h2>
            </div>
          </div>
          {loading ? (
            <div className="admin-inline-state">
              <LoaderCircle className="spin" size={20} aria-hidden="true" />
              Загружаем…
            </div>
          ) : page.items.length === 0 ? (
            <p className="admin-empty">По выбранным фильтрам записей нет.</p>
          ) : (
            <div className="admin-audit-entry-list">
              {page.items.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className={details?.id === entry.id ? "active" : ""}
                  onClick={() => selectEntry(entry)}
                >
                  <span className="admin-audit-mark" aria-hidden="true" />
                  <span>
                    <strong>{auditActionLabel(entry.action)}</strong>
                    <small>
                      {entry.entityType} · {entry.entityId}
                    </small>
                    <small>
                      {entry.adminUsername} · {formatAuditTime(entry.createdAt)}
                    </small>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
          {page.nextCursor && (
            <button
              className="admin-audit-load-more"
              type="button"
              disabled={loadingMore}
              onClick={loadMore}
            >
              {loadingMore && (
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
              )}
              Показать ещё
            </button>
          )}
        </section>

        <AuditDetailsPanel
          details={details}
          loading={detailsLoading}
          onClose={() => setDetails(null)}
        />
      </div>
    </AdminShell>
  )
}

function AuditDetailsPanel({
  details,
  loading,
  onClose,
}: {
  details: AdminAuditDetails | null
  loading: boolean
  onClose: () => void
}) {
  const rows = useMemo(
    () => (details ? auditDiffRows(details.before, details.after) : []),
    [details]
  )
  return (
    <aside className="admin-panel admin-audit-details">
      {loading ? (
        <div className="admin-inline-state">
          <LoaderCircle className="spin" size={20} aria-hidden="true" />
          Загружаем изменение…
        </div>
      ) : !details ? (
        <div className="admin-audit-placeholder">
          <ScrollText size={30} aria-hidden="true" />
          <p>Выберите действие, чтобы увидеть diff.</p>
        </div>
      ) : (
        <>
          <button
            className="admin-audit-close"
            type="button"
            aria-label="Закрыть детали"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
          <p className="admin-kicker">Изменение</p>
          <h2>{auditActionLabel(details.action)}</h2>
          <dl className="admin-audit-meta">
            <div>
              <dt>Время</dt>
              <dd>{formatAuditTime(details.createdAt)}</dd>
            </div>
            <div>
              <dt>Администратор</dt>
              <dd>{details.adminUsername}</dd>
            </div>
            <div>
              <dt>Сущность</dt>
              <dd>
                {details.entityType} · {details.entityId}
              </dd>
            </div>
            <div>
              <dt>Request ID</dt>
              <dd>{details.requestId}</dd>
            </div>
          </dl>
          {details.reason && (
            <div className="admin-audit-reason">
              <strong>Причина</strong>
              <p>{details.reason}</p>
            </div>
          )}
          <h3>Diff</h3>
          {rows.length === 0 ? (
            <p className="admin-empty">
              Снимки данных отсутствуют или совпадают.
            </p>
          ) : (
            <div className="admin-audit-diff">
              <div className="admin-audit-diff-heading">
                <span>Поле</span>
                <span>До</span>
                <span>После</span>
              </div>
              {rows.map((row) => (
                <div key={row.path}>
                  <code>{row.path}</code>
                  <pre>{row.before}</pre>
                  <pre>{row.after}</pre>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  )
}

function requestAuditPage(
  filters: AuditFilters,
  cursor: string | null,
  signal?: AbortSignal
) {
  const query = new URLSearchParams({ limit: "30" })
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue
    if (key === "dateFrom") {
      query.set(key, `${value}T00:00:00.000+03:00`)
    } else if (key === "dateTo") {
      query.set(key, `${value}T23:59:59.999+03:00`)
    } else {
      query.set(key, value)
    }
  }
  if (cursor) query.set("cursor", cursor)
  return apiRequest<AdminAuditPageData>(
    `/admin/audit-logs?${query.toString()}`,
    signal
  )
}
