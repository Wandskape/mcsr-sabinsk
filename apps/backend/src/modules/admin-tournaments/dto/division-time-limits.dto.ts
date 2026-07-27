import { ApiProperty } from "@nestjs/swagger"
import { IsInt, Max, Min } from "class-validator"

const MIN_TIME_LIMIT_MS = 60_000
const MAX_TIME_LIMIT_MS = 86_400_000

export class DivisionTimeLimitsDto {
  @ApiProperty({ example: 3_600_000 })
  @IsInt()
  @Min(MIN_TIME_LIMIT_MS)
  @Max(MAX_TIME_LIMIT_MS)
  BEGINNER!: number

  @ApiProperty({ example: 2_700_000 })
  @IsInt()
  @Min(MIN_TIME_LIMIT_MS)
  @Max(MAX_TIME_LIMIT_MS)
  EXPERIENCED!: number

  @ApiProperty({ example: 1_800_000 })
  @IsInt()
  @Min(MIN_TIME_LIMIT_MS)
  @Max(MAX_TIME_LIMIT_MS)
  PRO!: number
}
