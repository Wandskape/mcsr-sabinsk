interface Environment {
  NODE_ENV: "development" | "test" | "production"
  PORT: number
  FRONTEND_ORIGIN: string
  DATABASE_URL: string
  SESSION_SECRET: string
  CSRF_SECRET: string
  SESSION_COOKIE_NAME: string
  S3_ENDPOINT: string
  S3_REGION: string
  S3_BUCKET: string
  S3_ACCESS_KEY: string
  S3_SECRET_KEY: string
  RANKED_API_BASE_URL: string
}

function requireString(
  source: Record<string, unknown>,
  key: keyof Omit<Environment, "NODE_ENV" | "PORT" | "SESSION_COOKIE_NAME">
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
  const configuredCsrfSecret = source.CSRF_SECRET
  const csrfSecret =
    typeof configuredCsrfSecret === "string" &&
    configuredCsrfSecret.trim() !== ""
      ? configuredCsrfSecret
      : nodeEnvironment === "production"
        ? requireString(source, "CSRF_SECRET")
        : sessionSecret
  if (csrfSecret.length < 32) {
    throw new Error("CSRF_SECRET must contain at least 32 characters")
  }
  const sessionCookieName =
    typeof source.SESSION_COOKIE_NAME === "string" &&
    source.SESSION_COOKIE_NAME.trim() !== ""
      ? source.SESSION_COOKIE_NAME
      : "mcsr_admin_session"
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionCookieName)) {
    throw new Error("SESSION_COOKIE_NAME contains unsupported characters")
  }

  return {
    ...source,
    NODE_ENV: nodeEnvironment,
    PORT: port,
    FRONTEND_ORIGIN: requireString(source, "FRONTEND_ORIGIN"),
    DATABASE_URL: requireString(source, "DATABASE_URL"),
    SESSION_SECRET: sessionSecret,
    CSRF_SECRET: csrfSecret,
    SESSION_COOKIE_NAME: sessionCookieName,
    S3_ENDPOINT: requireString(source, "S3_ENDPOINT"),
    S3_REGION: requireString(source, "S3_REGION"),
    S3_BUCKET: requireString(source, "S3_BUCKET"),
    S3_ACCESS_KEY: requireString(source, "S3_ACCESS_KEY"),
    S3_SECRET_KEY: requireString(source, "S3_SECRET_KEY"),
    RANKED_API_BASE_URL:
      typeof source.RANKED_API_BASE_URL === "string" &&
      source.RANKED_API_BASE_URL.trim() !== ""
        ? validateRankedApiUrl(source.RANKED_API_BASE_URL, nodeEnvironment)
        : "https://api.mcsrranked.com",
  }
}

function validateRankedApiUrl(
  value: string,
  nodeEnvironment: Environment["NODE_ENV"]
) {
  const url = new URL(value)
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  if (
    url.protocol !== "https:" &&
    !(nodeEnvironment !== "production" && isLocal)
  ) {
    throw new Error(
      "RANKED_API_BASE_URL must use HTTPS (HTTP is allowed only for a local mock)"
    )
  }
  url.pathname = url.pathname.replace(/\/+$/, "")
  url.search = ""
  url.hash = ""
  return url.toString().replace(/\/$/, "")
}
