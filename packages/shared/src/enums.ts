import { z } from "zod"

export const TournamentStatusSchema = z.enum([
  "DRAFT",
  "UPCOMING",
  "QUALIFICATION",
  "PLAYOFF",
  "COMPLETED",
])
export type TournamentStatus = z.infer<typeof TournamentStatusSchema>

export const DivisionTypeSchema = z.enum(["BEGINNER", "EXPERIENCED", "PRO"])
export type DivisionType = z.infer<typeof DivisionTypeSchema>

export const QualificationResultStatusSchema = z.enum([
  "COMPLETED",
  "DNF",
  "MISSED",
])
export type QualificationResultStatus = z.infer<
  typeof QualificationResultStatusSchema
>

export const DIVISION_LABELS: Record<DivisionType, string> = {
  BEGINNER: "Новички",
  EXPERIENCED: "Опытные",
  PRO: "Про",
}

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  DRAFT: "Черновик",
  UPCOMING: "Предстоящий",
  QUALIFICATION: "Квалификация",
  PLAYOFF: "Плей-офф",
  COMPLETED: "Завершён",
}
