import type { AnalyticsViewType } from "@mcsr-sabinsk/shared"

import { API_BASE_URL } from "./api-client"

const DEDUPLICATION_MS = 30_000
const recentlySent = new Map<string, number>()

export function recordAnalyticsView(
  type: AnalyticsViewType,
  resourceId: string
) {
  const key = `${type}:${resourceId}`
  const now = Date.now()
  if ((recentlySent.get(key) ?? 0) > now) return
  recentlySent.set(key, now + DEDUPLICATION_MS)

  void fetch(`${API_BASE_URL}/analytics/views`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: {
      Accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ type, resourceId }),
  }).catch(() => {
    // Статистика не должна влиять на работу публичной страницы.
  })
}
