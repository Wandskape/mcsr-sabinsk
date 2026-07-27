import { Module } from "@nestjs/common"

import { RankedService } from "./ranked.service.js"

@Module({
  providers: [RankedService],
  exports: [RankedService],
})
export class RankedModule {}
