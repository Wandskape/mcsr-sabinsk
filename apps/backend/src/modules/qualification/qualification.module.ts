import { Module } from "@nestjs/common"

import { AuthModule } from "../auth/auth.module.js"
import { RankedModule } from "../ranked/ranked.module.js"
import { QualificationController } from "./qualification.controller.js"
import { QualificationImportController } from "./qualification-import.controller.js"
import { QualificationImportService } from "./qualification-import.service.js"
import { QualificationService } from "./qualification.service.js"

@Module({
  imports: [AuthModule, RankedModule],
  controllers: [QualificationController, QualificationImportController],
  providers: [QualificationService, QualificationImportService],
})
export class QualificationModule {}
