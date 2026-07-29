import { NotFoundException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"

import { AdminService } from "./admin.service.js"

function auditEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "audit-1",
    action: "TOURNAMENT_STATUS_CHANGED",
    entityType: "Tournament",
    entityId: "tournament-1",
    reason: null,
    requestId: "request-1",
    before: { status: "PLAYOFF" },
    after: { status: "COMPLETED" },
    createdAt: new Date("2026-07-27T12:00:00.000Z"),
    actorUsernameSnapshot: null,
    adminUser: { username: "admin" },
    ...overrides,
  }
}

function dependencies() {
  const prisma = {
    auditLog: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  }
  return {
    prisma,
    service: new AdminService(prisma as never),
  }
}

describe("AdminService audit log", () => {
  it("applies filters and returns an opaque next cursor", async () => {
    const { prisma, service } = dependencies()
    prisma.auditLog.findMany.mockResolvedValue([
      auditEntry(),
      auditEntry({ id: "audit-2" }),
    ])

    const result = await service.listAuditLogs({
      limit: 1,
      action: "TOURNAMENT_STATUS_CHANGED",
      adminUsername: "adm",
      dateFrom: "2026-07-01T00:00:00.000Z",
      dateTo: "2026-07-31T23:59:59.999Z",
    })

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        where: expect.objectContaining({
          action: "TOURNAMENT_STATUS_CHANGED",
          OR: [
            {
              actorUsernameSnapshot: {
                contains: "adm",
                mode: "insensitive",
              },
            },
            {
              adminUser: {
                username: { contains: "adm", mode: "insensitive" },
              },
            },
          ],
        }),
      })
    )
    expect(result.data).toEqual({
      items: [
        expect.objectContaining({
          id: "audit-1",
          adminUsername: "admin",
          createdAt: "2026-07-27T12:00:00.000Z",
        }),
      ],
      nextCursor: "audit-1",
    })
  })

  it("shows the archived actor snapshot after restoring an audit entry", async () => {
    const { prisma, service } = dependencies()
    prisma.auditLog.findUnique.mockResolvedValue(
      auditEntry({ actorUsernameSnapshot: "original-admin" })
    )

    const result = await service.getAuditLog("audit-1")

    expect(result.data.adminUsername).toBe("original-admin")
  })

  it("returns before and after snapshots for one entry", async () => {
    const { prisma, service } = dependencies()
    prisma.auditLog.findUnique.mockResolvedValue(auditEntry())

    const result = await service.getAuditLog("audit-1")

    expect(result.data).toMatchObject({
      id: "audit-1",
      requestId: "request-1",
      before: { status: "PLAYOFF" },
      after: { status: "COMPLETED" },
    })
  })

  it("returns 404 for a missing entry", async () => {
    const { prisma, service } = dependencies()
    prisma.auditLog.findUnique.mockResolvedValue(null)

    await expect(service.getAuditLog("missing")).rejects.toBeInstanceOf(
      NotFoundException
    )
  })
})
