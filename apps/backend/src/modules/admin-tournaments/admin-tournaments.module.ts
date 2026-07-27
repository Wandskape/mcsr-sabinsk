import { Module } from "@nestjs/common"

import { AuthModule } from "../auth/auth.module.js"
import { MediaModule } from "../media/media.module.js"
import { AdminTournamentsController } from "./admin-tournaments.controller.js"
import { AdminTournamentsService } from "./admin-tournaments.service.js"

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [AdminTournamentsController],
  providers: [AdminTournamentsService],
})
export class AdminTournamentsModule {}
