import { ApiProperty } from "@nestjs/swagger"
import { IsBoolean, IsString, MaxLength, MinLength } from "class-validator"

import { QualificationReimportDto } from "./qualification-reimport.dto.js"

export class CompletedQualificationCorrectionDto extends QualificationReimportDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  confirm!: boolean

  @ApiProperty({ minLength: 10, maxLength: 2_000 })
  @IsString()
  @MinLength(10)
  @MaxLength(2_000)
  reason!: string
}
