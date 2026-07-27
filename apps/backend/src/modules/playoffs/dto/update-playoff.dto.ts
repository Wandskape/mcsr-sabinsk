import { ApiProperty } from "@nestjs/swagger"
import { IsBoolean, IsInt, Min } from "class-validator"

export class UpdatePlayoffDto {
  @ApiProperty()
  @IsBoolean()
  showThirdPlace!: boolean

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number
}
