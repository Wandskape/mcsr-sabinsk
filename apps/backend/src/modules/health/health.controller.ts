import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common"
import { ApiOperation, ApiTags } from "@nestjs/swagger"

import { PrismaService } from "../prisma/prisma.service.js"

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("live")
  @ApiOperation({ summary: "Проверка процесса backend" })
  live() {
    return {
      data: {
        status: "ok",
        service: "mcsr-sabinsk-backend",
        timestamp: new Date().toISOString(),
      },
    }
  }

  @Get("ready")
  @ApiOperation({ summary: "Проверка готовности backend и PostgreSQL" })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return {
        data: {
          status: "ok",
          database: "connected",
          timestamp: new Date().toISOString(),
        },
      }
    } catch {
      throw new ServiceUnavailableException("PostgreSQL недоступен.")
    }
  }
}
