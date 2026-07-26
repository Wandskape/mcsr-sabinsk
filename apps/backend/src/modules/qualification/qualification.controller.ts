import { Controller, Get, Header, Inject, Param } from "@nestjs/common"
import { ApiOperation, ApiTags } from "@nestjs/swagger"

import { QualificationService } from "./qualification.service.js"

@ApiTags("qualification")
@Controller()
export class QualificationController {
  constructor(
    @Inject(QualificationService)
    private readonly qualification: QualificationService
  ) {}

  @Get("qualification-matches/:matchId")
  @Header("Cache-Control", "public, max-age=30")
  @ApiOperation({ summary: "Сохранённые результаты квалификационного матча" })
  getMatch(@Param("matchId") matchId: string) {
    return this.qualification.getMatch(matchId)
  }

  @Get("registrations/:registrationId/qualification")
  @Header("Cache-Control", "public, max-age=30")
  @ApiOperation({ summary: "Квалификация участника в выбранном турнире" })
  getParticipant(@Param("registrationId") registrationId: string) {
    return this.qualification.getParticipant(registrationId)
  }
}
