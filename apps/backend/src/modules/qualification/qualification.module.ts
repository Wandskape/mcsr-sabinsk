import { Module } from "@nestjs/common"

import { QualificationController } from "./qualification.controller.js"
import { QualificationService } from "./qualification.service.js"

@Module({
  controllers: [QualificationController],
  providers: [QualificationService],
})
export class QualificationModule {}
