import { z } from "zod"

const RankedMatchIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "Некорректный ID матча.")

export const QualificationImportPreviewRequestSchema = z.object({
  rankedMatchId: RankedMatchIdSchema,
})

export const QualificationImportRequestSchema = z.object({
  rankedMatchId: RankedMatchIdSchema,
  previewToken: z.string().min(20).max(1_000),
  expectedDivisionVersion: z.number().int().positive(),
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
export type QualificationReimportRequest = z.infer<
  typeof QualificationReimportRequestSchema
>
export type CompletedQualificationCorrectionRequest = z.infer<
  typeof CompletedQualificationCorrectionRequestSchema
>
