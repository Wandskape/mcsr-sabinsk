import { describe, expect, it } from "vitest"

import {
  QualificationImportPreviewRequestSchema,
  QualificationReimportPreviewRequestSchema,
} from "./qualification-imports.js"

describe("qualification completion limit contracts", () => {
  it.each([4, 6, 8, 10, 12])("accepts %i completions", (completionLimit) => {
    expect(
      QualificationImportPreviewRequestSchema.parse({
        rankedMatchId: "123456",
        completionLimit,
      }).completionLimit
    ).toBe(completionLimit)
  })

  it.each([0, 2, 5, 14])("rejects unsupported value %i", (completionLimit) => {
    expect(
      QualificationReimportPreviewRequestSchema.safeParse({
        completionLimit,
      }).success
    ).toBe(false)
  })
})
