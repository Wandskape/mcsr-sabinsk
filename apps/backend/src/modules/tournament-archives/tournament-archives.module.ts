import { Module } from "@nestjs/common"

import { AuditModule } from "../audit/audit.module.js"
import { AuthModule } from "../auth/auth.module.js"
import { MediaModule } from "../media/media.module.js"
import { TournamentArchivesController } from "./tournament-archives.controller.js"
import { TournamentArchivesService } from "./tournament-archives.service.js"

@Module({
  imports: [AuthModule, AuditModule, MediaModule],
  controllers: [TournamentArchivesController],
  providers: [TournamentArchivesService],
})
export class TournamentArchivesModule {}
