import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger"

import type { AuthenticatedRequest } from "../auth/auth.types.js"
import { AdminSessionGuard } from "../auth/guards/admin-session.guard.js"
import { CsrfGuard } from "../auth/guards/csrf.guard.js"
import { CompletedQualificationCorrectionDto } from "./dto/completed-qualification-correction.dto.js"
import { QualificationImportPreviewDto } from "./dto/qualification-import-preview.dto.js"
import { QualificationImportDto } from "./dto/qualification-import.dto.js"
import { QualificationReimportDto } from "./dto/qualification-reimport.dto.js"
import { QualificationImportService } from "./qualification-import.service.js"

function mutationContext(request: AuthenticatedRequest) {
  return {
    adminUserId: request.adminSession.admin.id,
    requestId: String(request.res?.locals.requestId ?? "unknown"),
  }
}

@ApiTags("admin qualification")
@Controller("admin")
@UseGuards(AdminSessionGuard)
export class QualificationImportController {
  constructor(
    @Inject(QualificationImportService)
    private readonly imports: QualificationImportService
  ) {}

  @Get("divisions/:divisionId/qualification-matches")
  @ApiOperation({ summary: "Список квалификационных матчей дивизиона" })
  list(
    @Param("divisionId", ParseUUIDPipe)
    divisionId: string
  ) {
    return this.imports.list(divisionId)
  }

  @Post("divisions/:divisionId/qualification-matches/import-preview")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: QualificationImportPreviewDto })
  @ApiOperation({ summary: "Предпросмотр импорта матча из MCSR Ranked" })
  previewNew(
    @Param("divisionId", ParseUUIDPipe) divisionId: string,
    @Body() input: QualificationImportPreviewDto
  ) {
    return this.imports.previewNew(divisionId, input.rankedMatchId)
  }

  @Post("divisions/:divisionId/qualification-matches/import")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: QualificationImportDto })
  @ApiOperation({ summary: "Импортировать проверенный Ranked-матч" })
  importNew(
    @Param("divisionId", ParseUUIDPipe) divisionId: string,
    @Body() input: QualificationImportDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.imports.importNew(divisionId, input, mutationContext(request))
  }

  @Post("qualification-matches/:matchId/reimport-preview")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Предпросмотр повторного импорта матча" })
  previewReimport(
    @Param("matchId", ParseUUIDPipe)
    matchId: string
  ) {
    return this.imports.previewReimport(matchId)
  }

  @Post("qualification-matches/:matchId/reimport")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: QualificationReimportDto })
  @ApiOperation({ summary: "Повторно импортировать матч" })
  reimport(
    @Param("matchId", ParseUUIDPipe) matchId: string,
    @Body() input: QualificationReimportDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.imports.reimport(matchId, input, mutationContext(request))
  }

  @Post("qualification-matches/:matchId/completed-correction")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: CompletedQualificationCorrectionDto })
  @ApiOperation({ summary: "Исправить матч завершённого турнира" })
  completedCorrection(
    @Param("matchId", ParseUUIDPipe) matchId: string,
    @Body() input: CompletedQualificationCorrectionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.imports.completedCorrection(
      matchId,
      input,
      mutationContext(request)
    )
  }

  @Get("qualification-matches/:matchId/imports")
  @ApiOperation({ summary: "История импортов квалификационного матча" })
  history(
    @Param("matchId", ParseUUIDPipe)
    matchId: string
  ) {
    return this.imports.history(matchId)
  }
}
