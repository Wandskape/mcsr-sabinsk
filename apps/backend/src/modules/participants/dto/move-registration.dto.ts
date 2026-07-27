import { ApiProperty } from "@nestjs/swagger"
import { IsInt, IsUUID, Min } from "class-validator"

export class MoveRegistrationDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  targetDivisionId!: string

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedRegistrationVersion!: number

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedSourceDivisionVersion!: number

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedTargetDivisionVersion!: number
}
