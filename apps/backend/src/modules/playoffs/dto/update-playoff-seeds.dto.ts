import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator"
import { Type } from "class-transformer"

class PlayoffSeedDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  seedNumber!: number

  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  registrationId!: string | null
}

export class UpdatePlayoffSeedsDto {
  @ApiProperty({ type: [PlayoffSeedDto] })
  @IsArray()
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => PlayoffSeedDto)
  seeds!: PlayoffSeedDto[]

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number
}
