import { randomUUID } from "node:crypto"

import type { Request } from "express"

const REQUEST_ID_LIMIT = 100
const SAFE_REQUEST_ID = /^[a-zA-Z0-9._:-]+$/

export function resolveRequestId(value: string | undefined) {
  const candidate = value?.trim().slice(0, REQUEST_ID_LIMIT)
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID()
}

export function httpLogPayload(input: {
  request: Request
  requestId: string
  statusCode: number
  durationMs: number
}) {
  return {
    event: "http_request",
    requestId: input.requestId,
    method: input.request.method,
    path: input.request.path,
    statusCode: input.statusCode,
    durationMs: Math.round(input.durationMs * 100) / 100,
    userAgent: input.request.header("user-agent")?.slice(0, 160) ?? null,
  }
}
