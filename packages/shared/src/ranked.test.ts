import { describe, expect, it } from "vitest"

import { parseRankedMatchPayload, parseRankedUserProfile } from "./ranked.js"

describe("MCSR Ranked user contract", () => {
  it("keeps only the validated public profile fields", () => {
    const profile = parseRankedUserProfile({
      status: "success",
      data: {
        uuid: "ABCDEF0123456789ABCDEF0123456789",
        nickname: "Player",
        roleType: 1,
        eloRate: 1_234,
        eloRank: 42,
        country: "ru",
        unexpected: "not exposed",
      },
    })

    expect(profile).toEqual({
      uuid: "abcdef0123456789abcdef0123456789",
      nickname: "Player",
      roleType: 1,
      eloRate: 1_234,
      eloRank: 42,
      country: "ru",
      avatarUrl:
        "https://mc-heads.net/avatar/abcdef0123456789abcdef0123456789/40",
    })
  })

  it("rejects malformed UUIDs and incomplete payloads", () => {
    expect(() =>
      parseRankedUserProfile({
        status: "success",
        data: {
          uuid: "../invalid",
          nickname: "Player",
        },
      })
    ).toThrow()
  })
})

describe("MCSR Ranked match contract", () => {
  it("normalizes UUIDs and supplies optional match arrays", () => {
    const match = parseRankedMatchPayload({
      status: "success",
      data: {
        id: 123_456,
        date: 1_700_000_000,
        players: [
          {
            uuid: "ABCDEF0123456789ABCDEF0123456789",
            nickname: "Player",
          },
        ],
      },
    })

    expect(match).toMatchObject({
      id: 123_456,
      spectators: [],
      completions: [],
      timelines: [],
      players: [
        {
          uuid: "abcdef0123456789abcdef0123456789",
          nickname: "Player",
        },
      ],
    })
  })

  it("rejects negative result times", () => {
    expect(() =>
      parseRankedMatchPayload({
        status: "success",
        data: {
          id: 1,
          date: 1_700_000_000,
          players: [],
          completions: [
            {
              uuid: "abcdef0123456789abcdef0123456789",
              time: -1,
            },
          ],
        },
      })
    ).toThrow()
  })
})
