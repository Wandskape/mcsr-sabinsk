import { describe, expect, it } from "vitest"

import {
  createQualificationPreviewToken,
  verifyQualificationPreviewToken,
} from "./qualification-preview-token.js"

const payload = {
  divisionId: "division",
  rankedMatchId: "123456",
  payloadHash: "a".repeat(64),
  matchId: null,
  expiresAt: 1_800_000_000_000,
}

describe("qualification preview token", () => {
  it("round-trips a signed payload", () => {
    const token = createQualificationPreviewToken(payload, "secret")

    expect(verifyQualificationPreviewToken(token, "secret")).toEqual(payload)
  })

  it("rejects a tampered token and a wrong secret", () => {
    const token = createQualificationPreviewToken(payload, "secret")
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`

    expect(verifyQualificationPreviewToken(tampered, "secret")).toBeNull()
    expect(verifyQualificationPreviewToken(token, "wrong")).toBeNull()
  })
})
