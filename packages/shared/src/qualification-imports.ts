import { z } from "zod"

import { QUALIFICATION_COMPLETION_LIMITS } from "./enums.js"

const RankedMatchIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "Некорректный ID матча.")

export const QualificationCompletionLimitSchema = z
  .number()
  .int()
  .refine(
    (value) =>
      QUALIFICATION_COMPLETION_LIMITS.includes(
        value as (typeof QUALIFICATION_COMPLETION_LIMITS)[number]
      ),
    "Лимит финишей должен быть равен 4, 6, 8, 10 или 12."
  )

export const QualificationImportPreviewRequestSchema = z.object({
  rankedMatchId: RankedMatchIdSchema,
  completionLimit: QualificationCompletionLimitSchema,
})

export const QualificationImportRequestSchema = z.object({
  rankedMatchId: RankedMatchIdSchema,
  completionLimit: QualificationCompletionLimitSchema,
  previewToken: z.string().min(20).max(1_000),
  expectedDivisionVersion: z.number().int().positive(),
})

export const QualificationReimportPreviewRequestSchema = z.object({
  completionLimit: QualificationCompletionLimitSchema,
})

export const QualificationReimportRequestSchema = z.object({
  previewToken: z.string().min(20).max(1_000),
  expectedMatchVersion: z.number().int().positive(),
})

export const CompletedQualificationCorrectionRequestSchema =
  QualificationReimportRequestSchema.extend({
    confirm: z.literal(true),
    reason: z.string().trim().min(10).max(2_000),
  })

export type QualificationImportPreviewRequest = z.infer<
  typeof QualificationImportPreviewRequestSchema
>
export type QualificationImportRequest = z.infer<
  typeof QualificationImportRequestSchema
>
export type QualificationReimportPreviewRequest = z.infer<
  typeof QualificationReimportPreviewRequestSchema
>
export type QualificationReimportRequest = z.infer<
  typeof QualificationReimportRequestSchema
>
export type CompletedQualificationCorrectionRequest = z.infer<
  typeof CompletedQualificationCorrectionRequestSchema
>
