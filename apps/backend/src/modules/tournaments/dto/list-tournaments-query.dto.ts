import { Transform, Type } from "class-transformer"
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator"

import { TournamentStatus } from "../../../generated/prisma/enums.js"

export class ListTournamentsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : [value]
  )
  @IsEnum(TournamentStatus, { each: true })
  status?: TournamentStatus[]

  @IsOptional()
  @IsString()
  cursor?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20
}
