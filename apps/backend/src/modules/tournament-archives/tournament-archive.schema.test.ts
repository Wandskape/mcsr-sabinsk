import { describe, expect, it } from "vitest"

import {
  tournamentArchiveDataSchema,
  tournamentArchiveManifestSchema,
} from "./tournament-archive.schema.js"

const id = "00000000-0000-4000-8000-000000000001"

describe("tournament archive schema", () => {
  it("accepts a minimal archive bundle", () => {
    expect(
      tournamentArchiveDataSchema.parse({
        tournaments: [
          {
            tournament: {
              id,
              name: "Кубок",
              slug: "cup",
              description: "",
              startsAt: "2026-07-01T00:00:00.000Z",
              endsAt: "2026-07-02T00:00:00.000Z",
              status: "DRAFT",
              coverObjectKey: null,
              coverUrl: null,
              version: 1,
              completedAt: null,
            },
            divisions: [],
            participants: [],
            registrations: [],
            qualificationMatches: [],
            qualificationImports: [],
            qualificationResults: [],
            playoffBrackets: [],
            playoffSeeds: [],
            playoffMatches: [],
            auditLogs: [],
            cover: null,
          },
        ],
      }).tournaments
    ).toHaveLength(1)
  })

  it("rejects an unsupported manifest version", () => {
    expect(() =>
      tournamentArchiveManifestSchema.parse({
        format: "mcsr-sabinsk-tournament-archive",
        version: 2,
        exportedAt: "2026-07-01T00:00:00.000Z",
        dataPath: "data.json",
        dataSha256: "a".repeat(64),
        tournamentCount: 1,
      })
    ).toThrow()
  })
})
