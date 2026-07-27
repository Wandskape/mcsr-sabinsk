import type { ApiEnvelope } from "@mcsr-sabinsk/shared"

export const API_BASE_URL =
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
    credentials: "include",
    headers: { Accept: "application/json" },
    signal: signal ?? null,
  })

  return readApiResponse<T>(response)
}

export async function apiCommand<T>(
  path: string,
  options: {
    method: "POST" | "PUT" | "PATCH" | "DELETE"
    body?: unknown
    csrfToken?: string
    signal?: AbortSignal
  }
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" })
  if (options.body !== undefined) {
    headers.set("content-type", "application/json")
  }
  if (options.csrfToken) {
    headers.set("x-csrf-token", options.csrfToken)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method,
    credentials: "include",
    headers,
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
    signal: options.signal ?? null,
  })

  if (response.status === 204) {
    return undefined as T
  }

  return readApiResponse<T>(response)
}

export async function apiFormCommand<T>(
  path: string,
  formData: FormData,
  csrfToken: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "x-csrf-token": csrfToken,
    },
    body: formData,
    signal: signal ?? null,
  })

  return readApiResponse<T>(response)
}

async function readApiResponse<T>(response: Response): Promise<T> {
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
