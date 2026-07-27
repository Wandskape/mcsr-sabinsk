import { describe, expect, it } from "vitest"

import { auditDiffRows } from "./audit-diff"

describe("auditDiffRows", () => {
  it("shows changed, added and removed nested values", () => {
    expect(
      auditDiffRows(
        {
          status: "PLAYOFF",
          divisions: [{ name: "Новички", published: false }],
          removed: 12,
        },
        {
          status: "COMPLETED",
          divisions: [{ name: "Новички", published: true }],
          added: "ok",
        }
      )
    ).toEqual([
      { path: "added", before: "—", after: "ok" },
      {
        path: "divisions.0.published",
        before: "false",
        after: "true",
      },
      { path: "removed", before: "12", after: "—" },
      { path: "status", before: "PLAYOFF", after: "COMPLETED" },
    ])
  })

  it("returns no rows for equal snapshots", () => {
    expect(auditDiffRows({ version: 2 }, { version: 2 })).toEqual([])
  })
})
