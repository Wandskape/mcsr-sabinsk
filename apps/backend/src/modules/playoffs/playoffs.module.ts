import { Module } from "@nestjs/common"

import { AuthModule } from "../auth/auth.module.js"
import { PlayoffsController } from "./playoffs.controller.js"
import { PlayoffsService } from "./playoffs.service.js"

@Module({
  imports: [AuthModule],
  controllers: [PlayoffsController],
  providers: [PlayoffsService],
  exports: [PlayoffsService],
})
export class PlayoffsModule {}
