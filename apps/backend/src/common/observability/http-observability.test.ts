import type { Request } from "express"
import { describe, expect, it } from "vitest"

import { httpLogPayload, resolveRequestId } from "./http-observability.js"

describe("HTTP observability", () => {
  it("keeps a safe caller request ID", () => {
    expect(resolveRequestId("deploy-check:42")).toBe("deploy-check:42")
  })

  it("replaces unsafe request IDs", () => {
    expect(resolveRequestId("line\nbreak")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i
    )
  })

  it("does not include query values or request bodies in access logs", () => {
    const request = {
      method: "GET",
      path: "/api/v1/tournaments",
      header: () => "vitest",
    } as unknown as Request

    expect(
      httpLogPayload({
        request,
        requestId: "request-1",
        statusCode: 200,
        durationMs: 12.345,
      })
    ).toEqual({
      event: "http_request",
      requestId: "request-1",
      method: "GET",
      path: "/api/v1/tournaments",
      statusCode: 200,
      durationMs: 12.35,
      userAgent: "vitest",
    })
  })
})
