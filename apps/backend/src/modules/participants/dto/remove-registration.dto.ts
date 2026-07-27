import { ApiProperty } from "@nestjs/swagger"
import { IsInt, Min } from "class-validator"

export class RemoveRegistrationDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedRegistrationVersion!: number

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedDivisionVersion!: number
}
