import { Type } from "class-transformer"
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator"

export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30

  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityType?: string

  @IsOptional()
  @IsString()
  @MaxLength(140)
  entityId?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  adminUsername?: string

  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @IsOptional()
  @IsDateString()
  dateTo?: string
}
