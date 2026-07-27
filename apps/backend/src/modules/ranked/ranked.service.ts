import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
  parseRankedUserProfile,
  type RankedUserProfile,
} from "@mcsr-sabinsk/shared"

const REQUEST_TIMEOUT_MS = 5_000
const MAX_ATTEMPTS = 3

function retryDelay(response: Response, attempt: number) {
  const header = response.headers.get("retry-after")
  const seconds = header ? Number(header) : Number.NaN
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 5_000)
  }
  return Math.min(250 * 2 ** attempt, 1_000)
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

@Injectable()
export class RankedService {
  private readonly baseUrl: string

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.baseUrl = config
      .getOrThrow<string>("RANKED_API_BASE_URL")
      .replace(/\/$/, "")
  }

  async resolveUser(identifier: string): Promise<RankedUserProfile | null> {
    const normalized = identifier.trim()
    let lastFailure: unknown = null

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(
          `${this.baseUrl}/users/${encodeURIComponent(normalized)}`,
          {
            headers: { Accept: "application/json" },
            redirect: "error",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          }
        )

        if ([400, 401, 404].includes(response.status)) {
          return null
        }
        if (response.status === 429 || response.status >= 500) {
          lastFailure = new Error(`Ranked API returned ${response.status}`)
          if (attempt + 1 < MAX_ATTEMPTS) {
            await wait(retryDelay(response, attempt))
            continue
          }
          break
        }
        if (!response.ok) {
          throw new BadGatewayException("Ranked API вернул неожиданный ответ.")
        }

        try {
          return parseRankedUserProfile(await response.json())
        } catch {
          throw new BadGatewayException(
            "Ranked API вернул данные неизвестного формата."
          )
        }
      } catch (error) {
        if (error instanceof BadGatewayException) {
          throw error
        }
        lastFailure = error
        if (attempt + 1 < MAX_ATTEMPTS) {
          await wait(250 * 2 ** attempt)
          continue
        }
      }
    }

    void lastFailure
    throw new ServiceUnavailableException(
      "Ranked API временно недоступен. Повторите попытку позже."
    )
  }

  async resolveUsers(identifiers: string[]) {
    const results = new Map<string, RankedUserProfile | null | Error>()
    const batchSize = 8

    for (let index = 0; index < identifiers.length; index += batchSize) {
      const batch = identifiers.slice(index, index + batchSize)
      const batchResults = await Promise.all(
        batch.map(async (identifier) => {
          try {
            return await this.resolveUser(identifier)
          } catch (error) {
            return error instanceof Error ? error : new Error("Unknown error")
          }
        })
      )
      batch.forEach((identifier, resultIndex) => {
        results.set(identifier, batchResults[resultIndex] ?? null)
      })
    }

    return results
  }
}
