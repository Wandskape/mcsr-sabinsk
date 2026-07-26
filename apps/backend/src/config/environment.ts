interface Environment {
  NODE_ENV: "development" | "test" | "production"
  PORT: number
  FRONTEND_ORIGIN: string
  DATABASE_URL: string
  SESSION_SECRET: string
}

function requireString(
  source: Record<string, unknown>,
  key: keyof Omit<Environment, "NODE_ENV" | "PORT">
) {
  const value = source[key]
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Environment variable ${key} is required`)
  }
  return value
}

export function validateEnvironment(
  source: Record<string, unknown>
): Environment & Record<string, unknown> {
  const nodeEnvironment = source.NODE_ENV ?? "development"
  if (
    nodeEnvironment !== "development" &&
    nodeEnvironment !== "test" &&
    nodeEnvironment !== "production"
  ) {
    throw new Error("NODE_ENV must be development, test or production")
  }

  const port = Number(source.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535")
  }

  const sessionSecret = requireString(source, "SESSION_SECRET")
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters")
  }

  return {
    ...source,
    NODE_ENV: nodeEnvironment,
    PORT: port,
    FRONTEND_ORIGIN: requireString(source, "FRONTEND_ORIGIN"),
    DATABASE_URL: requireString(source, "DATABASE_URL"),
    SESSION_SECRET: sessionSecret,
  }
}
