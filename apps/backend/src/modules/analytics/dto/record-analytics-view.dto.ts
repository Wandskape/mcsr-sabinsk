import { ApiProperty } from "@nestjs/swagger"
import type { AnalyticsViewType } from "@mcsr-sabinsk/shared"
import { IsIn, IsUUID } from "class-validator"

export class RecordAnalyticsViewDto {
  @ApiProperty({ enum: ["TOURNAMENT", "PARTICIPANT", "MATCH"] })
  @IsIn(["TOURNAMENT", "PARTICIPANT", "MATCH"])
  type!: AnalyticsViewType

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  resourceId!: string
}
