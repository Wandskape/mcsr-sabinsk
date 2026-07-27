import type { AdminSession } from "@mcsr-sabinsk/shared"
import { ClipboardList, LoaderCircle, LogOut, Trophy } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import { apiCommand } from "@/lib/api-client"

interface AdminShellProps {
  session: AdminSession
  active: "overview" | "tournaments"
  children: ReactNode
}

export function AdminShell({ session, active, children }: AdminShellProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function logout() {
    setIsLoggingOut(true)
    try {
      await apiCommand<void>("/auth/logout", {
        method: "POST",
        csrfToken: session.csrfToken,
      })
    } finally {
      window.location.replace("/admin/login")
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin">
          <span>MS</span>
          <strong>MCSR Сабинск</strong>
        </a>
        <nav aria-label="Разделы админ-панели">
          <a className={active === "overview" ? "active" : ""} href="/admin">
            <ClipboardList size={18} aria-hidden="true" />
            Обзор
          </a>
          <a
            className={active === "tournaments" ? "active" : ""}
            href="/admin/tournaments"
          >
            <Trophy size={18} aria-hidden="true" />
            Турниры
          </a>
        </nav>
        <div className="admin-sidebar-footer">
          <small>Вы вошли как</small>
          <strong>{session.admin.username}</strong>
          <button disabled={isLoggingOut} onClick={logout}>
            {isLoggingOut ? (
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
            ) : (
              <LogOut size={17} aria-hidden="true" />
            )}
            Выйти
          </button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  )
}
