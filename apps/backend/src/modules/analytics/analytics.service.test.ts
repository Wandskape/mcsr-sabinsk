import type { Request } from "express"
import { describe, expect, it, vi } from "vitest"

import { AnalyticsEventType } from "../../generated/prisma/enums.js"
import { AnalyticsService } from "./analytics.service.js"

function dependencies() {
  const prisma = {
    tournament: { count: vi.fn().mockResolvedValue(1) },
    tournamentRegistration: { count: vi.fn().mockResolvedValue(1) },
    qualificationMatch: { count: vi.fn().mockResolvedValue(1) },
    analyticsEvent: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    analyticsDailyMetric: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn((queries: Array<Promise<unknown>>) =>
      Promise.all(queries)
    ),
  }
  const auth = { authenticate: vi.fn().mockResolvedValue(null) }
  const config = {
    getOrThrow: vi.fn().mockReturnValue("a".repeat(64)),
  }
  const service = new AnalyticsService(
    prisma as never,
    auth as never,
    config as never
  )
  const request = {
    ip: "127.0.0.1",
    header: vi.fn((name: string) =>
      name === "user-agent" ? "test-agent" : undefined
    ),
  } as unknown as Request
  return { prisma, auth, service, request }
}

describe("AnalyticsService", () => {
  it("records a public tournament view and its daily aggregate", async () => {
    const { prisma, service, request } = dependencies()

    const result = await service.recordView(
      "TOURNAMENT",
      "00000000-0000-4000-8000-000000000001",
      request
    )

    expect(result.data.accepted).toBe(true)
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: AnalyticsEventType.TOURNAMENT_VIEW,
      }),
    })
    expect(prisma.analyticsDailyMetric.upsert).toHaveBeenCalledOnce()
  })

  it("does not count the same view twice within 30 seconds", async () => {
    const { prisma, service, request } = dependencies()
    const resourceId = "00000000-0000-4000-8000-000000000001"

    const first = await service.recordView("MATCH", resourceId, request)
    const second = await service.recordView("MATCH", resourceId, request)

    expect(first.data.accepted).toBe(true)
    expect(second.data.accepted).toBe(false)
    expect(prisma.analyticsEvent.create).toHaveBeenCalledOnce()
  })

  it("excludes requests with an active admin session", async () => {
    const { prisma, auth, service, request } = dependencies()
    auth.authenticate.mockResolvedValue({ admin: { id: "admin" } })

    const result = await service.recordView(
      "PARTICIPANT",
      "00000000-0000-4000-8000-000000000001",
      request
    )

    expect(result.data.accepted).toBe(false)
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled()
  })

  it("builds a zero-filled seven-day series", async () => {
    const { prisma, service } = dependencies()
    const today = new Date()
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(today)
    prisma.analyticsDailyMetric.findMany.mockResolvedValue([
      {
        day: new Date(`${day}T00:00:00.000Z`),
        eventType: AnalyticsEventType.MATCH_VIEW,
        count: 4,
      },
    ])

    const result = await service.getStatistics("7_DAYS")

    expect(result.data.series).toHaveLength(7)
    expect(result.data.totals).toEqual({
      tournamentViews: 0,
      participantViews: 0,
      matchViews: 4,
    })
  })
})
