import { Module } from "@nestjs/common"
import { ThrottlerModule } from "@nestjs/throttler"

import { AuthController } from "./auth.controller.js"
import { AuthService } from "./auth.service.js"
import { AdminSessionGuard } from "./guards/admin-session.guard.js"
import { CsrfGuard } from "./guards/csrf.guard.js"

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 15 * 60 * 1_000,
        limit: 25,
        blockDuration: 15 * 60 * 1_000,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AdminSessionGuard, CsrfGuard],
  exports: [AuthService, AdminSessionGuard, CsrfGuard],
})
export class AuthModule {}
