import { createHmac } from "node:crypto"

import { Inject, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type {
  AdminAnalytics,
  AnalyticsPeriod,
  AnalyticsViewAccepted,
  AnalyticsViewType,
} from "@mcsr-sabinsk/shared"
import type { Request } from "express"

import { AnalyticsEventType } from "../../generated/prisma/enums.js"
import { AuthService } from "../auth/auth.service.js"
import { PrismaService } from "../prisma/prisma.service.js"

const VIEW_DEDUPLICATION_MS = 30_000
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 120
const RAW_RETENTION_DAYS = 180
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1_000

interface RateBucket {
  startedAt: number
  count: number
}

const eventTypeByView: Record<AnalyticsViewType, AnalyticsEventType> = {
  TOURNAMENT: AnalyticsEventType.TOURNAMENT_VIEW,
  PARTICIPANT: AnalyticsEventType.PARTICIPANT_VIEW,
  MATCH: AnalyticsEventType.MATCH_VIEW,
}

function moscowDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value)
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day")))
}

function addDays(day: Date, amount: number) {
  return new Date(day.getTime() + amount * 24 * 60 * 60 * 1_000)
}

function periodStart(period: AnalyticsPeriod, today: Date) {
  if (period === "TODAY") return today
  if (period === "7_DAYS") return addDays(today, -6)
  if (period === "30_DAYS") return addDays(today, -29)
  return null
}

@Injectable()
export class AnalyticsService {
  private readonly memorySecret: string
  private readonly duplicateUntil = new Map<string, number>()
  private readonly rateBuckets = new Map<string, RateBucket>()
  private lastCleanupAt = 0

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) config: ConfigService
  ) {
    this.memorySecret = config.getOrThrow<string>("SESSION_SECRET")
  }

  async recordView(
    type: AnalyticsViewType,
    resourceId: string,
    request: Request
  ): Promise<{ data: AnalyticsViewAccepted }> {
    if (await this.auth.authenticate(request)) {
      return { data: { accepted: false } }
    }

    const now = new Date()
    const nowMs = now.getTime()
    const requestFingerprint = this.fingerprint(
      `${request.ip}|${request.header("user-agent") ?? ""}`
    )
    if (!this.acceptRate(requestFingerprint, nowMs)) {
      return { data: { accepted: false } }
    }

    const duplicateKey = this.fingerprint(
      `${requestFingerprint}|${type}|${resourceId}`
    )
    if ((this.duplicateUntil.get(duplicateKey) ?? 0) > nowMs) {
      return { data: { accepted: false } }
    }
    if (!(await this.resourceExists(type, resourceId))) {
      return { data: { accepted: false } }
    }

    const eventType = eventTypeByView[type]
    const day = moscowDay(now)
    await this.prisma.$transaction([
      this.prisma.analyticsEvent.create({
        data: { eventType, resourceId, occurredAt: now },
      }),
      this.prisma.analyticsDailyMetric.upsert({
        where: { day_eventType: { day, eventType } },
        create: { day, eventType, count: 1 },
        update: { count: { increment: 1 } },
      }),
    ])
    this.duplicateUntil.set(duplicateKey, nowMs + VIEW_DEDUPLICATION_MS)
    await this.cleanupRawEvents(now)
    return { data: { accepted: true } }
  }

  async getStatistics(
    period: AnalyticsPeriod = "7_DAYS"
  ): Promise<{ data: AdminAnalytics }> {
    const today = moscowDay(new Date())
    const start = periodStart(period, today)
    const rows = await this.prisma.analyticsDailyMetric.findMany({
      where: start
        ? { day: { gte: start, lte: today } }
        : { day: { lte: today } },
      orderBy: { day: "asc" },
    })
    const firstDay = start ?? (rows[0]?.day ? moscowDay(rows[0].day) : today)
    const byDay = new Map<
      string,
      { tournamentViews: number; participantViews: number; matchViews: number }
    >()
    for (const row of rows) {
      const key = row.day.toISOString().slice(0, 10)
      const point = byDay.get(key) ?? {
        tournamentViews: 0,
        participantViews: 0,
        matchViews: 0,
      }
      if (row.eventType === AnalyticsEventType.TOURNAMENT_VIEW) {
        point.tournamentViews += row.count
      } else if (row.eventType === AnalyticsEventType.PARTICIPANT_VIEW) {
        point.participantViews += row.count
      } else {
        point.matchViews += row.count
      }
      byDay.set(key, point)
    }

    const series: AdminAnalytics["series"] = []
    for (let day = firstDay; day <= today; day = addDays(day, 1)) {
      const date = day.toISOString().slice(0, 10)
      series.push({
        date,
        ...(byDay.get(date) ?? {
          tournamentViews: 0,
          participantViews: 0,
          matchViews: 0,
        }),
      })
    }
    const totals = series.reduce(
      (sum, point) => ({
        tournamentViews: sum.tournamentViews + point.tournamentViews,
        participantViews: sum.participantViews + point.participantViews,
        matchViews: sum.matchViews + point.matchViews,
      }),
      { tournamentViews: 0, participantViews: 0, matchViews: 0 }
    )
    return {
      data: {
        period,
        totals,
        series,
        rawEventRetentionDays: RAW_RETENTION_DAYS,
      },
    }
  }

  private async resourceExists(type: AnalyticsViewType, resourceId: string) {
    if (type === "TOURNAMENT") {
      return (
        (await this.prisma.tournament.count({
          where: { id: resourceId, status: { not: "DRAFT" } },
        })) === 1
      )
    }
    if (type === "PARTICIPANT") {
      return (
        (await this.prisma.tournamentRegistration.count({
          where: {
            id: resourceId,
            tournament: { status: { not: "DRAFT" } },
          },
        })) === 1
      )
    }
    return (
      (await this.prisma.qualificationMatch.count({
        where: {
          id: resourceId,
          division: { tournament: { status: { not: "DRAFT" } } },
        },
      })) === 1
    )
  }

  private acceptRate(fingerprint: string, now: number) {
    const current = this.rateBuckets.get(fingerprint)
    if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
      this.rateBuckets.set(fingerprint, { startedAt: now, count: 1 })
      this.pruneMemory(now)
      return true
    }
    if (current.count >= RATE_LIMIT) return false
    current.count += 1
    return true
  }

  private pruneMemory(now: number) {
    if (this.duplicateUntil.size > 10_000) {
      for (const [key, expiresAt] of this.duplicateUntil) {
        if (expiresAt <= now) this.duplicateUntil.delete(key)
      }
    }
    if (this.rateBuckets.size > 10_000) {
      for (const [key, bucket] of this.rateBuckets) {
        if (now - bucket.startedAt >= RATE_WINDOW_MS) {
          this.rateBuckets.delete(key)
        }
      }
    }
  }

  private fingerprint(value: string) {
    return createHmac("sha256", this.memorySecret).update(value).digest("hex")
  }

  private async cleanupRawEvents(now: Date) {
    if (now.getTime() - this.lastCleanupAt < CLEANUP_INTERVAL_MS) return
    this.lastCleanupAt = now.getTime()
    await this.prisma.analyticsEvent.deleteMany({
      where: {
        occurredAt: {
          lt: new Date(
            now.getTime() - RAW_RETENTION_DAYS * 24 * 60 * 60 * 1_000
          ),
        },
      },
    })
  }
}
