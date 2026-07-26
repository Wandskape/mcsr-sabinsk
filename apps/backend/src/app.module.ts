import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { validateEnvironment } from "./config/environment.js"
import { AdminModule } from "./modules/admin/admin.module.js"
import { AuditModule } from "./modules/audit/audit.module.js"
import { AuthModule } from "./modules/auth/auth.module.js"
import { HealthModule } from "./modules/health/health.module.js"
import { PrismaModule } from "./modules/prisma/prisma.module.js"
import { QualificationModule } from "./modules/qualification/qualification.module.js"
import { TournamentsModule } from "./modules/tournaments/tournaments.module.js"

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    AdminModule,
    HealthModule,
    TournamentsModule,
    QualificationModule,
  ],
})
export class AppModule {}
