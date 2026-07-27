import "reflect-metadata"

import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { describe, expect, it } from "vitest"

import { ListTournamentsQueryDto } from "./list-tournaments-query.dto.js"

describe("ListTournamentsQueryDto", () => {
  it("accepts and transforms the public limit query", async () => {
    const query = plainToInstance(ListTournamentsQueryDto, {
      limit: "100",
    })

    expect(await validate(query, { whitelist: true })).toEqual([])
    expect(query.limit).toBe(100)
  })

  it("rejects a limit above the public maximum", async () => {
    const query = plainToInstance(ListTournamentsQueryDto, {
      limit: "101",
    })

    expect(await validate(query, { whitelist: true })).not.toEqual([])
  })
})
