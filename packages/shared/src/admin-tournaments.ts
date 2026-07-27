import { z } from "zod"

import { TournamentStatusSchema } from "./enums.js"

const TimeLimitSchema = z
  .number()
  .int("Лимит должен быть целым числом миллисекунд.")
  .min(60_000, "Минимальный лимит — одна минута.")
  .max(86_400_000, "Максимальный лимит — 24 часа.")

export const DivisionTimeLimitsSchema = z.object({
  BEGINNER: TimeLimitSchema,
  EXPERIENCED: TimeLimitSchema,
  PRO: TimeLimitSchema,
})

const TournamentFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Введите название.")
    .max(120, "Название должно быть не длиннее 120 символов."),
  slug: z
    .string()
    .trim()
    .min(1, "Введите slug.")
    .max(140, "Slug должен быть не длиннее 140 символов.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug может содержать строчные латинские буквы, цифры и дефисы."
    ),
  description: z
    .string()
    .trim()
    .max(10_000, "Описание должно быть не длиннее 10 000 символов."),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  divisionTimeLimitsMs: DivisionTimeLimitsSchema,
})

function withValidDateRange<T extends typeof TournamentFieldsSchema>(
  schema: T
) {
  return schema.refine(
    (input) =>
      new Date(input.startsAt).getTime() < new Date(input.endsAt).getTime(),
    {
      message: "Дата окончания должна быть позже даты начала.",
      path: ["endsAt"],
    }
  )
}

export const CreateTournamentRequestSchema = withValidDateRange(
  TournamentFieldsSchema
)

export const UpdateTournamentRequestSchema = withValidDateRange(
  TournamentFieldsSchema.extend({
    expectedVersion: z.number().int().positive(),
  })
)

export const ChangeTournamentStatusRequestSchema = z.object({
  status: TournamentStatusSchema,
  expectedVersion: z.number().int().positive(),
})

export const SetTournamentCoverRequestSchema = z.object({
  objectKey: z.string().min(1).max(512),
  expectedVersion: z.number().int().positive(),
})

export const RemoveTournamentCoverRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
})

export type DivisionTimeLimits = z.infer<typeof DivisionTimeLimitsSchema>
export type CreateTournamentRequest = z.infer<
  typeof CreateTournamentRequestSchema
>
export type UpdateTournamentRequest = z.infer<
  typeof UpdateTournamentRequestSchema
>
export type ChangeTournamentStatusRequest = z.infer<
  typeof ChangeTournamentStatusRequestSchema
>
export type SetTournamentCoverRequest = z.infer<
  typeof SetTournamentCoverRequestSchema
>
export type RemoveTournamentCoverRequest = z.infer<
  typeof RemoveTournamentCoverRequestSchema
>
