import { Module } from "@nestjs/common"

import { PlayoffsModule } from "../playoffs/playoffs.module.js"
import { TournamentsController } from "./tournaments.controller.js"
import { TournamentsService } from "./tournaments.service.js"

@Module({
  imports: [PlayoffsModule],
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
