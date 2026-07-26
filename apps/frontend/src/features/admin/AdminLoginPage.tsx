import { zodResolver } from "@hookform/resolvers/zod"
import {
  LoginRequestSchema,
  type AdminSession,
  type LoginRequest,
} from "@mcsr-sabinsk/shared"
import { ArrowLeft, KeyRound, LoaderCircle, LockKeyhole } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { ApiError, apiCommand, apiRequest } from "@/lib/api-client"

export function AdminLoginPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: { username: "", password: "" },
  })

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<AdminSession>("/auth/me", controller.signal)
      .then(() => window.location.replace("/admin"))
      .catch(() => setCheckingSession(false))

    return () => controller.abort()
  }, [])

  const submit = handleSubmit(async (input) => {
    setServerError(null)
    try {
      await apiCommand<AdminSession>("/auth/login", {
        method: "POST",
        body: input,
      })
      window.location.replace("/admin")
    } catch (error) {
      setServerError(
        error instanceof ApiError && error.status === 429
          ? "Слишком много попыток. Повторите вход через 15 минут."
          : "Неверный логин или пароль."
      )
    }
  })

  return (
    <div className="admin-login-shell">
      <a className="admin-back-link" href="/">
        <ArrowLeft aria-hidden="true" size={17} />
        Вернуться к турнирам
      </a>

      <section className="admin-login-card" aria-labelledby="login-title">
        <div className="admin-login-icon" aria-hidden="true">
          <LockKeyhole size={29} />
        </div>
        <p className="admin-kicker">MCSR Сабинск</p>
        <h1 id="login-title">Вход администратора</h1>
        <p className="admin-login-copy">
          Управление турнирами доступно только организаторам.
        </p>

        {checkingSession ? (
          <div className="admin-login-check">
            <LoaderCircle className="spin" size={20} aria-hidden="true" />
            Проверяем сессию…
          </div>
        ) : (
          <form className="admin-form" onSubmit={submit} noValidate>
            <label>
              <span>Логин</span>
              <input
                autoComplete="username"
                autoFocus
                aria-invalid={errors.username ? "true" : "false"}
                {...register("username")}
              />
              {errors.username && (
                <small role="alert">{errors.username.message}</small>
              )}
            </label>

            <label>
              <span>Пароль</span>
              <input
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? "true" : "false"}
                {...register("password")}
              />
              {errors.password && (
                <small role="alert">{errors.password.message}</small>
              )}
            </label>

            {serverError && (
              <p className="admin-form-error" role="alert">
                {serverError}
              </p>
            )}

            <button className="admin-primary-button" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircle className="spin" size={19} aria-hidden="true" />
              ) : (
                <KeyRound size={19} aria-hidden="true" />
              )}
              {isSubmitting ? "Входим…" : "Войти"}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
