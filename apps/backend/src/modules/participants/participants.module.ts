import { Module } from "@nestjs/common"

import { AuthModule } from "../auth/auth.module.js"
import { RankedModule } from "../ranked/ranked.module.js"
import { ParticipantsController } from "./participants.controller.js"
import { ParticipantsService } from "./participants.service.js"

@Module({
  imports: [AuthModule, RankedModule],
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
})
export class ParticipantsModule {}
