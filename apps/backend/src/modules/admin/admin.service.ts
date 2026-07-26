import { Inject, Injectable } from "@nestjs/common"
import type { AdminOverview } from "@mcsr-sabinsk/shared"

import { TournamentStatus } from "../../generated/prisma/enums.js"
import { PrismaService } from "../prisma/prisma.service.js"

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
      recentAudit: audit.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        reason: entry.reason,
        createdAt: entry.createdAt.toISOString(),
        adminUsername: entry.adminUser.username,
      })),
    }

    return { data: overview }
  }
}
