import { ApiProperty } from "@nestjs/swagger"
import { IsString, Matches, MaxLength } from "class-validator"

import { QualificationCompletionLimitDto } from "./qualification-completion-limit.dto.js"

export class QualificationImportPreviewDto extends QualificationCompletionLimitDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_-]+$/)
  rankedMatchId!: string
}
