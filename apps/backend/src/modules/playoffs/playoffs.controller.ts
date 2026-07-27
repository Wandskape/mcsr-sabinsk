import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger"

import type { AuthenticatedRequest } from "../auth/auth.types.js"
import { AdminSessionGuard } from "../auth/guards/admin-session.guard.js"
import { CsrfGuard } from "../auth/guards/csrf.guard.js"
import { CreatePlayoffDto } from "./dto/create-playoff.dto.js"
import { PlayoffVersionDto } from "./dto/playoff-version.dto.js"
import { UpdatePlayoffMatchDto } from "./dto/update-playoff-match.dto.js"
import { UpdatePlayoffSeedsDto } from "./dto/update-playoff-seeds.dto.js"
import { UpdatePlayoffDto } from "./dto/update-playoff.dto.js"
import { PlayoffsService } from "./playoffs.service.js"

function mutationContext(request: AuthenticatedRequest) {
  return {
    adminUserId: request.adminSession.admin.id,
    requestId: String(request.res?.locals.requestId ?? "unknown"),
  }
}

@ApiTags("admin playoffs")
@Controller("admin")
@UseGuards(AdminSessionGuard)
export class PlayoffsController {
  constructor(
    @Inject(PlayoffsService)
    private readonly playoffs: PlayoffsService
  ) {}

  @Get("divisions/:divisionId/playoff")
  @ApiOperation({ summary: "Сетка дивизиона для администратора" })
  getByDivision(@Param("divisionId", ParseUUIDPipe) divisionId: string) {
    return this.playoffs.getAdminByDivision(divisionId)
  }

  @Post("divisions/:divisionId/playoff")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: CreatePlayoffDto })
  @ApiOperation({ summary: "Создать ручную сетку плей-офф" })
  create(
    @Param("divisionId", ParseUUIDPipe) divisionId: string,
    @Body() input: CreatePlayoffDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.playoffs.create(divisionId, input, mutationContext(request))
  }

  @Get("playoffs/:id")
  @ApiOperation({ summary: "Сетка плей-офф для администратора" })
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.playoffs.getAdmin(id)
  }

  @Patch("playoffs/:id")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: UpdatePlayoffDto })
  @ApiOperation({ summary: "Изменить настройки сетки" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePlayoffDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.playoffs.update(id, input, mutationContext(request))
  }

  @Put("playoffs/:id/seeds")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: UpdatePlayoffSeedsDto })
  @ApiOperation({ summary: "Обновить ручной посев" })
  updateSeeds(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePlayoffSeedsDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.playoffs.updateSeeds(id, input, mutationContext(request))
  }

  @Patch("playoff-matches/:matchId")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: UpdatePlayoffMatchDto })
  @ApiOperation({ summary: "Изменить пару, счёт и победителя матча" })
  updateMatch(
    @Param("matchId", ParseUUIDPipe) matchId: string,
    @Body() input: UpdatePlayoffMatchDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.playoffs.updateMatch(matchId, input, mutationContext(request))
  }

  @Post("playoffs/:id/publish")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: PlayoffVersionDto })
  @ApiOperation({ summary: "Опубликовать сетку" })
  publish(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PlayoffVersionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.playoffs.publish(
      id,
      input.expectedVersion,
      true,
      mutationContext(request)
    )
  }

  @Post("playoffs/:id/unpublish")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: PlayoffVersionDto })
  @ApiOperation({ summary: "Снять сетку с публикации" })
  unpublish(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: PlayoffVersionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.playoffs.publish(
      id,
      input.expectedVersion,
      false,
      mutationContext(request)
    )
  }
}
