import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger"

import type { AuthenticatedRequest } from "../auth/auth.types.js"
import { AdminSessionGuard } from "../auth/guards/admin-session.guard.js"
import { CsrfGuard } from "../auth/guards/csrf.guard.js"
import { AdminTournamentsService } from "./admin-tournaments.service.js"
import { ChangeTournamentStatusDto } from "./dto/change-tournament-status.dto.js"
import { CreateTournamentDto } from "./dto/create-tournament.dto.js"
import { RemoveTournamentCoverDto } from "./dto/remove-tournament-cover.dto.js"
import { SetTournamentCoverDto } from "./dto/set-tournament-cover.dto.js"
import { UpdateTournamentDto } from "./dto/update-tournament.dto.js"

function mutationContext(request: AuthenticatedRequest) {
  return {
    adminUserId: request.adminSession.admin.id,
    requestId: String(request.res?.locals.requestId ?? "unknown"),
  }
}

@ApiTags("admin tournaments")
@Controller("admin/tournaments")
@UseGuards(AdminSessionGuard)
export class AdminTournamentsController {
  constructor(
    @Inject(AdminTournamentsService)
    private readonly tournaments: AdminTournamentsService
  ) {}

  @Get()
  @ApiOperation({ summary: "Список турниров для администратора" })
  list() {
    return this.tournaments.list()
  }

  @Get(":id")
  @ApiOperation({ summary: "Турнир для редактирования" })
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.tournaments.get(id)
  }

  @Post()
  @UseGuards(CsrfGuard)
  @ApiBody({ type: CreateTournamentDto })
  @ApiOperation({ summary: "Создать турнир-черновик и три дивизиона" })
  create(
    @Body() input: CreateTournamentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tournaments.create(input, mutationContext(request))
  }

  @Patch(":id")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: UpdateTournamentDto })
  @ApiOperation({ summary: "Изменить турнир и лимиты дивизионов" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateTournamentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tournaments.update(id, input, mutationContext(request))
  }

  @Post(":id/status")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: ChangeTournamentStatusDto })
  @ApiOperation({ summary: "Перевести турнир в следующий статус" })
  changeStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ChangeTournamentStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tournaments.changeStatus(id, input, mutationContext(request))
  }

  @Post(":id/cover")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: SetTournamentCoverDto })
  @ApiOperation({ summary: "Назначить загруженную обложку турниру" })
  setCover(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: SetTournamentCoverDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tournaments.setCover(id, input, mutationContext(request))
  }

  @Delete(":id/cover")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: RemoveTournamentCoverDto })
  @ApiOperation({ summary: "Убрать обложку турнира" })
  removeCover(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: RemoveTournamentCoverDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.tournaments.removeCover(id, input, mutationContext(request))
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard)
  @ApiBody({ type: RemoveTournamentCoverDto })
  @ApiOperation({ summary: "Удалить пустой турнир-черновик" })
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: RemoveTournamentCoverDto,
    @Req() request: AuthenticatedRequest
  ) {
    await this.tournaments.delete(
      id,
      input.expectedVersion,
      mutationContext(request)
    )
  }
}
