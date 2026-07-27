import { describe, expect, it } from "vitest"

import { isDivisionPublic } from "./division-visibility.js"

describe("public division visibility", () => {
  it("shows all available divisions before qualification", () => {
    expect(isDivisionPublic("UPCOMING", false)).toBe(true)
  })

  it("shows only participating divisions after qualification starts", () => {
    expect(isDivisionPublic("QUALIFICATION", true)).toBe(true)
    expect(isDivisionPublic("QUALIFICATION", false)).toBe(false)
    expect(isDivisionPublic("PLAYOFF", false)).toBe(false)
    expect(isDivisionPublic("COMPLETED", false)).toBe(false)
  })
})
