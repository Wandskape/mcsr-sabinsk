import { ApiProperty } from "@nestjs/swagger"
import { IsInt, IsString, MaxLength, Min, MinLength } from "class-validator"

export class QualificationReimportDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(1_000)
  previewToken!: string

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  expectedMatchVersion!: number
}
