import { describe, expect, it } from "vitest"

import { securityHeaders } from "./security.js"

function directivesFor(options: ReturnType<typeof securityHeaders>) {
  const policy = options.contentSecurityPolicy
  if (!policy || policy === true) {
    throw new Error("Explicit CSP directives are required")
  }
  return policy.directives
}

describe("securityHeaders", () => {
  it("uses a strict production CSP and HSTS", () => {
    const options = securityHeaders({
      isProduction: true,
      mediaOrigin: "https://media.example.com",
    })
    const directives = directivesFor(options)

    expect(directives?.frameAncestors).toEqual(["'none'"])
    expect(directives?.objectSrc).toEqual(["'none'"])
    expect(directives?.imgSrc).toContain("https://media.example.com")
    expect(directives?.scriptSrc).not.toContain("'unsafe-inline'")
    expect(options.hsts).toMatchObject({
      maxAge: 31_536_000,
      includeSubDomains: true,
    })
  })

  it("allows Swagger inline assets only outside production", () => {
    const options = securityHeaders({
      isProduction: false,
      mediaOrigin: "http://localhost:9000",
    })
    const directives = directivesFor(options)

    expect(directives?.scriptSrc).toContain("'unsafe-inline'")
    expect(options.hsts).toBe(false)
  })
})
