import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import type {
  AdminAuditDetails,
  AdminAuditEntry,
  AdminAuditPage,
  AdminOverview,
} from "@mcsr-sabinsk/shared"

import type { Prisma } from "../../generated/prisma/client.js"
import { TournamentStatus } from "../../generated/prisma/enums.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto.js"

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOverview(adminUserId: string) {
    const [
      tournamentCount,
      activeTournamentCount,
      draftTournamentCount,
      audit,
    ] = await this.prisma.$transaction([
      this.prisma.tournament.count(),
      this.prisma.tournament.count({
        where: {
          status: {
            in: [TournamentStatus.QUALIFICATION, TournamentStatus.PLAYOFF],
          },
        },
      }),
      this.prisma.tournament.count({
        where: { status: TournamentStatus.DRAFT },
      }),
      this.prisma.auditLog.findMany({
        where: { adminUserId },
        include: {
          adminUser: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ])

    const overview: AdminOverview = {
      tournamentCount,
      activeTournamentCount,
      draftTournamentCount,
      recentAudit: audit.map((entry) => this.mapAuditEntry(entry)),
    }

    return { data: overview }
  }

  async listAuditLogs(query: ListAuditLogsQueryDto) {
    const take = query.limit ?? 30
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.adminUsername
        ? {
            OR: [
              {
                actorUsernameSnapshot: {
                  contains: query.adminUsername,
                  mode: "insensitive",
                },
              },
              {
                adminUser: {
                  username: {
                    contains: query.adminUsername,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    }
    const entries = await this.prisma.auditLog.findMany({
      where,
      include: {
        adminUser: { select: { username: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
    })
    const hasMore = entries.length > take
    const page = entries.slice(0, take)
    const data: AdminAuditPage = {
      items: page.map((entry) => this.mapAuditEntry(entry)),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    }
    return { data }
  }

  async getAuditLog(id: string) {
    const entry = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        adminUser: { select: { username: true } },
      },
    })
    if (!entry) {
      throw new NotFoundException("Запись аудита не найдена.")
    }
    const data: AdminAuditDetails = {
      ...this.mapAuditEntry(entry),
      requestId: entry.requestId,
      before: entry.before,
      after: entry.after,
    }
    return { data }
  }

  private mapAuditEntry(entry: {
    id: string
    action: string
    entityType: string
    entityId: string
    reason: string | null
    createdAt: Date
    actorUsernameSnapshot: string | null
    adminUser: { username: string }
  }): AdminAuditEntry {
    return {
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
      adminUsername: entry.actorUsernameSnapshot ?? entry.adminUser.username,
    }
  }
}
