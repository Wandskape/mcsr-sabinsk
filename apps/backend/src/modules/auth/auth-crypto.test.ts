import { describe, expect, it } from "vitest"

import {
  createCsrfToken,
  generateSessionToken,
  hashIpAddress,
  hashSessionToken,
  tokensMatch,
} from "./auth-crypto.js"

describe("auth crypto", () => {
  it("generates independent 256-bit session tokens", () => {
    const first = generateSessionToken()
    const second = generateSessionToken()

    expect(Buffer.from(first, "base64url")).toHaveLength(32)
    expect(Buffer.from(second, "base64url")).toHaveLength(32)
    expect(first).not.toBe(second)
  })

  it("stores deterministic keyed session hashes", () => {
    const token = "session-token"

    expect(hashSessionToken(token, "secret-a")).toBe(
      hashSessionToken(token, "secret-a")
    )
    expect(hashSessionToken(token, "secret-a")).not.toBe(
      hashSessionToken(token, "secret-b")
    )
  })

  it("binds the CSRF token to the session and compares it safely", () => {
    const token = createCsrfToken("session-a", "csrf-secret")

    expect(tokensMatch(token, token)).toBe(true)
    expect(
      tokensMatch(token, createCsrfToken("session-b", "csrf-secret"))
    ).toBe(false)
    expect(tokensMatch("short", token)).toBe(false)
  })

  it("hashes IP addresses without exposing their value", () => {
    const hash = hashIpAddress("127.0.0.1", "server-secret")

    expect(hash).toHaveLength(64)
    expect(hash).not.toContain("127.0.0.1")
  })
})
