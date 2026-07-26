import type { ApiEnvelope } from "@mcsr-sabinsk/shared"

const API_BASE_URL =
  import.meta.env.PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1"

interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function apiRequest<T>(
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    signal: signal ?? null,
  })

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => null)) as ApiErrorResponse | null
    throw new ApiError(
      payload?.error?.message ?? "Не удалось загрузить данные.",
      response.status
    )
  }

  const payload = (await response.json()) as ApiEnvelope<T>
  return payload.data
}
