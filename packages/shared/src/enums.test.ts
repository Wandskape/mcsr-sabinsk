import { describe, expect, it } from "vitest"

import {
  DIVISION_LABELS,
  DivisionTypeSchema,
  TournamentStatusSchema,
} from "./enums.js"

describe("shared domain enums", () => {
  it("contains the three approved divisions", () => {
    expect(DivisionTypeSchema.options).toEqual([
      "BEGINNER",
      "EXPERIENCED",
      "PRO",
    ])
    expect(DIVISION_LABELS.EXPERIENCED).toBe("Опытные")
  })

  it("contains the approved tournament lifecycle", () => {
    expect(TournamentStatusSchema.options).toHaveLength(5)
    expect(TournamentStatusSchema.parse("PLAYOFF")).toBe("PLAYOFF")
  })
})
