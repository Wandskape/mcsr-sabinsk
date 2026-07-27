import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from "class-validator"

import { PlayoffMatchStatus } from "../../../generated/prisma/enums.js"

export class UpdatePlayoffMatchDto {
  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  participant1RegistrationId!: string | null

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  participant2RegistrationId!: string | null

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  score1!: number | null

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  score2!: number | null

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  winnerRegistrationId!: string | null

  @ApiProperty({ enum: PlayoffMatchStatus })
  @IsEnum(PlayoffMatchStatus)
  status!: PlayoffMatchStatus

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number
}
