import { ApiProperty } from "@nestjs/swagger"
import { IsEnum, IsInt, Min } from "class-validator"

import { TournamentStatus } from "../../../generated/prisma/enums.js"

export class ChangeTournamentStatusDto {
  @ApiProperty({ enum: TournamentStatus })
  @IsEnum(TournamentStatus)
  status!: TournamentStatus

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number
}
