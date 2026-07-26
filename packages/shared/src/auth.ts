import { z } from "zod"

export const LoginRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Введите логин.")
    .max(64, "Логин слишком длинный."),
  password: z
    .string()
    .min(12, "Пароль должен содержать не менее 12 символов.")
    .max(256, "Пароль слишком длинный."),
})

export type LoginRequest = z.infer<typeof LoginRequestSchema>
