import { z } from "zod"

const MinecraftIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Введите ник.")
  .max(64, "Идентификатор слишком длинный.")
  .regex(
    /^(?:[A-Za-z0-9_]{1,32}|[0-9a-fA-F]{32})$/,
    "Введите Minecraft-ник или UUID без дефисов."
  )

export const ResolveRankedUserRequestSchema = z.object({
  identifier: MinecraftIdentifierSchema,
})

export const PreviewRegistrationsRequestSchema = z.object({
  nicknames: z
    .array(MinecraftIdentifierSchema)
    .min(1, "Добавьте хотя бы один ник.")
    .max(100, "За один раз можно проверить не более 100 ников."),
})

export const AddRegistrationRequestSchema = z.object({
  identifier: MinecraftIdentifierSchema,
  expectedDivisionVersion: z.number().int().positive(),
})

export const AddRegistrationsBulkRequestSchema = z.object({
  nicknames: z
    .array(MinecraftIdentifierSchema)
    .min(1, "Добавьте хотя бы один ник.")
    .max(100, "За один раз можно добавить не более 100 участников."),
  expectedDivisionVersion: z.number().int().positive(),
})

export const RemoveRegistrationRequestSchema = z.object({
  expectedRegistrationVersion: z.number().int().positive(),
  expectedDivisionVersion: z.number().int().positive(),
})

export const MoveRegistrationRequestSchema = z.object({
  targetDivisionId: z.string().uuid(),
  expectedRegistrationVersion: z.number().int().positive(),
  expectedSourceDivisionVersion: z.number().int().positive(),
  expectedTargetDivisionVersion: z.number().int().positive(),
})

export type ResolveRankedUserRequest = z.infer<
  typeof ResolveRankedUserRequestSchema
>
export type PreviewRegistrationsRequest = z.infer<
  typeof PreviewRegistrationsRequestSchema
>
export type AddRegistrationRequest = z.infer<
  typeof AddRegistrationRequestSchema
>
export type AddRegistrationsBulkRequest = z.infer<
  typeof AddRegistrationsBulkRequestSchema
>
export type RemoveRegistrationRequest = z.infer<
  typeof RemoveRegistrationRequestSchema
>
export type MoveRegistrationRequest = z.infer<
  typeof MoveRegistrationRequestSchema
>
