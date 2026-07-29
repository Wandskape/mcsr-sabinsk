import { z } from "zod"

import type { RankedUserProfile } from "./contracts.js"

export const RANKED_SEED_TYPES = [
  "BURIED_TREASURE",
  "SHIPWRECK",
  "VILLAGE",
  "RUINED_PORTAL",
  "DESERT_TEMPLE",
] as const
export type RankedSeedType = (typeof RANKED_SEED_TYPES)[number]

export const RANKED_BASTION_TYPES = [
  "BRIDGE",
  "HOUSING",
  "TREASURE",
  "STABLES",
] as const
export type RankedBastionType = (typeof RANKED_BASTION_TYPES)[number]

const RankedSeedTypeSchema = z.enum(RANKED_SEED_TYPES)
const RankedBastionTypeSchema = z.enum(RANKED_BASTION_TYPES)

function normalizeRankedEnvironmentValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): T | null {
  if (typeof value !== "string") return null
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
  return allowedValues.includes(normalized as T) ? (normalized as T) : null
}

export function normalizeRankedSeedType(value: unknown): RankedSeedType | null {
  return normalizeRankedEnvironmentValue(value, RANKED_SEED_TYPES)
}

export function normalizeRankedBastionType(
  value: unknown
): RankedBastionType | null {
  return normalizeRankedEnvironmentValue(value, RANKED_BASTION_TYPES)
}

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

const RankedMatchPlayerSchema = z
  .object({
    uuid: z.string().regex(/^[0-9a-fA-F]{32}$/),
    nickname: z.string().min(1).max(32),
  })
  .passthrough()

export const RankedMatchEnvelopeSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    id: z.union([z.string(), z.number().int()]),
    date: z.union([z.string(), z.number()]),
    players: z.array(RankedMatchPlayerSchema),
    spectators: z.array(RankedMatchPlayerSchema).default([]),
    completions: z
      .array(
        z.object({
          uuid: z.string().regex(/^[0-9a-fA-F]{32}$/),
          time: z.number().int().nonnegative(),
        })
      )
      .default([]),
    timelines: z
      .array(
        z.object({
          uuid: z.string().regex(/^[0-9a-fA-F]{32}$/),
          time: z.number().int().nonnegative(),
          type: z.string().min(1).max(160),
        })
      )
      .default([]),
    seedType: z
      .preprocess(normalizeRankedSeedType, RankedSeedTypeSchema.nullable())
      .default(null),
    bastionType: z
      .preprocess(
        normalizeRankedBastionType,
        RankedBastionTypeSchema.nullable()
      )
      .default(null),
  }),
})

export type RankedMatchPayload = z.infer<
  typeof RankedMatchEnvelopeSchema
>["data"]

export function parseRankedMatchPayload(payload: unknown): RankedMatchPayload {
  const parsed = RankedMatchEnvelopeSchema.parse(payload).data
  return {
    ...parsed,
    players: parsed.players.map((player) => ({
      ...player,
      uuid: player.uuid.toLowerCase(),
    })),
    spectators: parsed.spectators.map((player) => ({
      ...player,
      uuid: player.uuid.toLowerCase(),
    })),
    completions: parsed.completions.map((completion) => ({
      ...completion,
      uuid: completion.uuid.toLowerCase(),
    })),
    timelines: parsed.timelines.map((event) => ({
      ...event,
      uuid: event.uuid.toLowerCase(),
    })),
  }
}
