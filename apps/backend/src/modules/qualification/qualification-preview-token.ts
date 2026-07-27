import { createHmac, timingSafeEqual } from "node:crypto"

import {
  QUALIFICATION_COMPLETION_LIMITS,
  type QualificationCompletionLimit,
} from "@mcsr-sabinsk/shared"

export interface QualificationPreviewTokenPayload {
  divisionId: string
  rankedMatchId: string
  completionLimit: QualificationCompletionLimit
  payloadHash: string
  matchId: string | null
  expiresAt: number
}

export function createQualificationPreviewToken(
  payload: QualificationPreviewTokenPayload,
  secret: string
) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url")
  return `${encoded}.${signature}`
}

export function verifyQualificationPreviewToken(
  token: string,
  secret: string
): QualificationPreviewTokenPayload | null {
  const [encoded, receivedSignature] = token.split(".")
  if (!encoded || !receivedSignature) return null
  const expectedSignature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url")
  const received = Buffer.from(receivedSignature)
  const expected = Buffer.from(expectedSignature)
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return null
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Partial<QualificationPreviewTokenPayload>
    if (
      typeof parsed.divisionId !== "string" ||
      typeof parsed.rankedMatchId !== "string" ||
      !QUALIFICATION_COMPLETION_LIMITS.includes(
        parsed.completionLimit as QualificationCompletionLimit
      ) ||
      typeof parsed.payloadHash !== "string" ||
      (parsed.matchId !== null && typeof parsed.matchId !== "string") ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null
    }
    return parsed as QualificationPreviewTokenPayload
  } catch {
    return null
  }
}
