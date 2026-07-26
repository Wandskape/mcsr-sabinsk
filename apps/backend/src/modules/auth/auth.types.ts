import type { Request } from "express"

export interface AuthenticatedAdminSession {
  sessionId: string
  sessionToken: string
  csrfToken: string
  expiresAt: Date
  admin: {
    id: string
    username: string
  }
}

export type AuthenticatedRequest = Request & {
  adminSession: AuthenticatedAdminSession
}

export interface AuthenticationRequestContext {
  ipAddress: string
  userAgent: string | null
  requestId: string
}
