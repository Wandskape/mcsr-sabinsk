import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseEnumPipe,
  Query,
} from "@nestjs/common"
import { ApiExtraModels, ApiOperation, ApiTags } from "@nestjs/swagger"

import { DivisionType } from "../../generated/prisma/enums.js"
import { ListTournamentsQueryDto } from "./dto/list-tournaments-query.dto.js"
import { TournamentsService } from "./tournaments.service.js"

@ApiTags("tournaments")
@ApiExtraModels(ListTournamentsQueryDto)
@Controller("tournaments")
export class TournamentsController {
  constructor(
    @Inject(TournamentsService)
    private readonly tournaments: TournamentsService
  ) {}

  @Get()
  @Header("Cache-Control", "public, max-age=30")
  @ApiOperation({ summary: "Публичный список турниров" })
  list(@Query() query: ListTournamentsQueryDto) {
    return this.tournaments.list(query)
  }

  @Get("default")
  @Header("Cache-Control", "public, max-age=30")
  @ApiOperation({ summary: "Турнир, выбранный по умолчанию" })
  getDefault() {
    return this.tournaments.getDefault()
  }

  @Get(":slug")
  @Header("Cache-Control", "public, max-age=30")
  @ApiOperation({ summary: "Публичная карточка турнира" })
  getBySlug(@Param("slug") slug: string) {
    return this.tournaments.getBySlug(slug)
  }

  @Get(":slug/divisions/:divisionType/standings")
  @Header("Cache-Control", "public, max-age=30")
  @ApiOperation({ summary: "Лидерборд дивизиона" })
  getStandings(
    @Param("slug") slug: string,
    @Param("divisionType", new ParseEnumPipe(DivisionType))
    divisionType: DivisionType
  ) {
    return this.tournaments.getStandings(slug, divisionType)
  }

  @Get(":slug/divisions/:divisionType/matches")
  @Header("Cache-Control", "public, max-age=30")
  @ApiOperation({ summary: "Квалификационные матчи дивизиона" })
  getMatches(
    @Param("slug") slug: string,
    @Param("divisionType", new ParseEnumPipe(DivisionType))
    divisionType: DivisionType
  ) {
    return this.tournaments.getMatches(slug, divisionType)
  }
}
