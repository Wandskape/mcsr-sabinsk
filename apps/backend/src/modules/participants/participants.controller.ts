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
import { AddRegistrationDto } from "./dto/add-registration.dto.js"
import { AddRegistrationsBulkDto } from "./dto/add-registrations-bulk.dto.js"
import { PreviewRegistrationsDto } from "./dto/preview-registrations.dto.js"
import { RemoveRegistrationDto } from "./dto/remove-registration.dto.js"
import { ResolveRankedUserDto } from "./dto/resolve-ranked-user.dto.js"
import { MoveRegistrationDto } from "./dto/move-registration.dto.js"
import { ParticipantsService } from "./participants.service.js"

function mutationContext(request: AuthenticatedRequest) {
  return {
    adminUserId: request.adminSession.admin.id,
    requestId: String(request.res?.locals.requestId ?? "unknown"),
  }
}

@ApiTags("admin participants")
@Controller("admin")
@UseGuards(AdminSessionGuard)
export class ParticipantsController {
  constructor(
    @Inject(ParticipantsService)
    private readonly participants: ParticipantsService
  ) {}

  @Post("ranked/resolve-user")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: ResolveRankedUserDto })
  @ApiOperation({ summary: "Проверить профиль в MCSR Ranked" })
  resolveUser(@Body() input: ResolveRankedUserDto) {
    return this.participants.resolveUser(input.identifier)
  }

  @Get("divisions/:divisionId/registrations")
  @ApiOperation({ summary: "Состав дивизиона" })
  list(
    @Param("divisionId", ParseUUIDPipe)
    divisionId: string
  ) {
    return this.participants.list(divisionId)
  }

  @Post("divisions/:divisionId/registrations/preview")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: PreviewRegistrationsDto })
  @ApiOperation({ summary: "Проверить список участников без записи" })
  preview(
    @Param("divisionId", ParseUUIDPipe) divisionId: string,
    @Body() input: PreviewRegistrationsDto
  ) {
    return this.participants.preview(divisionId, input.nicknames)
  }

  @Post("divisions/:divisionId/registrations")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: AddRegistrationDto })
  @ApiOperation({ summary: "Проверить и добавить одного участника" })
  addOne(
    @Param("divisionId", ParseUUIDPipe) divisionId: string,
    @Body() input: AddRegistrationDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.participants.addOne(
      divisionId,
      input.identifier,
      input.expectedDivisionVersion,
      mutationContext(request)
    )
  }

  @Post("divisions/:divisionId/registrations/bulk")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: AddRegistrationsBulkDto })
  @ApiOperation({ summary: "Добавить проверенный список одной транзакцией" })
  addBulk(
    @Param("divisionId", ParseUUIDPipe) divisionId: string,
    @Body() input: AddRegistrationsBulkDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.participants.addBulk(
      divisionId,
      input.nicknames,
      input.expectedDivisionVersion,
      mutationContext(request)
    )
  }

  @Delete("registrations/:registrationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard)
  @ApiBody({ type: RemoveRegistrationDto })
  @ApiOperation({ summary: "Удалить участника из состава" })
  async remove(
    @Param("registrationId", ParseUUIDPipe) registrationId: string,
    @Body() input: RemoveRegistrationDto,
    @Req() request: AuthenticatedRequest
  ) {
    await this.participants.remove(
      registrationId,
      input.expectedRegistrationVersion,
      input.expectedDivisionVersion,
      mutationContext(request)
    )
  }

  @Patch("registrations/:registrationId")
  @UseGuards(CsrfGuard)
  @ApiBody({ type: MoveRegistrationDto })
  @ApiOperation({ summary: "Переместить участника в другой дивизион" })
  move(
    @Param("registrationId", ParseUUIDPipe) registrationId: string,
    @Body() input: MoveRegistrationDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.participants.move(
      registrationId,
      input,
      mutationContext(request)
    )
  }
}
