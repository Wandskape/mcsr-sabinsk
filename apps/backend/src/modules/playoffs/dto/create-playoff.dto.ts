import { ApiProperty } from "@nestjs/swagger"
import { IsBoolean, IsIn, IsInt, Min } from "class-validator"

export class CreatePlayoffDto {
  @ApiProperty({ enum: [4, 8, 16] })
  @IsInt()
  @IsIn([4, 8, 16])
  size!: 4 | 8 | 16

  @ApiProperty({ default: false })
  @IsBoolean()
  showThirdPlace!: boolean

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedDivisionVersion!: number
}
