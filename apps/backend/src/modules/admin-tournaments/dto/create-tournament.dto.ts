import { ApiProperty } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator"

import { DivisionTimeLimitsDto } from "./division-time-limits.dto.js"

export class CreateTournamentDto {
  @ApiProperty({ example: "Кубок Сабинска #1", maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string

  @ApiProperty({ example: "kubok-sabinska-1", maxLength: 140 })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(140)
  slug!: string

  @ApiProperty({ example: "Первый открытый турнир.", maxLength: 10_000 })
  @IsString()
  @MaxLength(10_000)
  description!: string

  @ApiProperty({ example: "2026-08-10T09:00:00.000Z" })
  @IsISO8601({ strict: true })
  startsAt!: string

  @ApiProperty({ example: "2026-08-17T18:00:00.000Z" })
  @IsISO8601({ strict: true })
  endsAt!: string

  @ApiProperty({ type: DivisionTimeLimitsDto })
  @ValidateNested()
  @Type(() => DivisionTimeLimitsDto)
  divisionTimeLimitsMs!: DivisionTimeLimitsDto
}
