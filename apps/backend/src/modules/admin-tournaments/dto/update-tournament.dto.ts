import { ApiProperty } from "@nestjs/swagger"
import { IsInt, Min } from "class-validator"

import { CreateTournamentDto } from "./create-tournament.dto.js"

export class UpdateTournamentDto extends CreateTournamentDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number
}
