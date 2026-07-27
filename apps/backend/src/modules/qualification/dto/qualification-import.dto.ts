import { ApiProperty } from "@nestjs/swagger"
import { IsInt, IsString, MaxLength, Min, MinLength } from "class-validator"

import { QualificationImportPreviewDto } from "./qualification-import-preview.dto.js"

export class QualificationImportDto extends QualificationImportPreviewDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(1_000)
  previewToken!: string

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  expectedDivisionVersion!: number
}
