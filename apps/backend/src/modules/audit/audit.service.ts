import { Inject, Injectable } from "@nestjs/common"

import type { Prisma } from "../../generated/prisma/client.js"
import { PrismaService } from "../prisma/prisma.service.js"

type AuditWriter = Pick<Prisma.TransactionClient, "auditLog">

export interface AuditEvent {
  adminUserId: string
  action: string
  entityType: string
  entityId: string
  requestId: string
  ipHash?: string | null
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
  reason?: string | null
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  record(event: AuditEvent, writer: AuditWriter = this.prisma) {
    return writer.auditLog.create({
      data: {
        adminUserId: event.adminUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        requestId: event.requestId,
        ...(event.ipHash !== undefined ? { ipHash: event.ipHash } : {}),
        ...(event.before !== undefined ? { before: event.before } : {}),
        ...(event.after !== undefined ? { after: event.after } : {}),
        ...(event.reason !== undefined ? { reason: event.reason } : {}),
      },
    })
  }
}
