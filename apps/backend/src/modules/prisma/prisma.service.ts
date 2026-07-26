import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../../generated/prisma/client.js"

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(@Inject(ConfigService) config: ConfigService) {
    const connectionString = config.getOrThrow<string>("DATABASE_URL")
    super({
      adapter: new PrismaPg({
        connectionString,
        connectionTimeoutMillis: 5_000,
      }),
    })
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
