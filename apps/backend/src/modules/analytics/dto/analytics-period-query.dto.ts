import type { AnalyticsPeriod } from "@mcsr-sabinsk/shared"
import { IsIn, IsOptional } from "class-validator"

export class AnalyticsPeriodQueryDto {
  @IsOptional()
  @IsIn(["TODAY", "7_DAYS", "30_DAYS", "ALL_TIME"])
  period?: AnalyticsPeriod
}
