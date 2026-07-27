import { describe, expect, it } from "vitest"

import {
  AddRegistrationsBulkRequestSchema,
  PreviewRegistrationsRequestSchema,
} from "./registrations.js"

describe("registration request contracts", () => {
  it("accepts nicknames and UUID identifiers", () => {
    expect(
      PreviewRegistrationsRequestSchema.parse({
        nicknames: ["Player_1", "abcdef0123456789abcdef0123456789"],
      }).nicknames
    ).toHaveLength(2)
  })

  it("rejects URL-like identifiers and oversized batches", () => {
    expect(
      PreviewRegistrationsRequestSchema.safeParse({
        nicknames: ["https://example.com"],
      }).success
    ).toBe(false)
    expect(
      PreviewRegistrationsRequestSchema.safeParse({
        nicknames: Array.from({ length: 101 }, (_, index) => `Player${index}`),
      }).success
    ).toBe(false)
  })

  it("requires optimistic locking for a bulk write", () => {
    expect(
      AddRegistrationsBulkRequestSchema.safeParse({
        nicknames: ["Player"],
        expectedDivisionVersion: 0,
      }).success
    ).toBe(false)
  })
})
