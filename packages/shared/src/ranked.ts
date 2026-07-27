import { z } from "zod"

import type { RankedUserProfile } from "./contracts.js"

export const RankedUserEnvelopeSchema = z.object({
  status: z.literal("success"),
  data: z
    .object({
      uuid: z.string().regex(/^[0-9a-fA-F]{32}$/),
      nickname: z.string().min(1).max(32),
      roleType: z.number().int(),
      eloRate: z.number().int().nullable(),
      eloRank: z.number().int().nullable(),
      country: z
        .string()
        .regex(/^[a-z]{2}$/)
        .nullable(),
    })
    .passthrough(),
})

export function parseRankedUserProfile(payload: unknown): RankedUserProfile {
  const parsed = RankedUserEnvelopeSchema.parse(payload).data
  const uuid = parsed.uuid.toLowerCase()
  return {
    uuid,
    nickname: parsed.nickname,
    roleType: parsed.roleType,
    eloRate: parsed.eloRate,
    eloRank: parsed.eloRank,
    country: parsed.country,
    avatarUrl: `https://mc-heads.net/avatar/${uuid}/40`,
  }
}
