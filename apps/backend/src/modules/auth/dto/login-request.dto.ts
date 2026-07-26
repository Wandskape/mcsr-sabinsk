import { ApiProperty } from "@nestjs/swagger"
import { IsString, Length, MaxLength } from "class-validator"

export class LoginRequestDto {
  @ApiProperty({ example: "admin", maxLength: 64 })
  @IsString()
  @Length(1, 64)
  username!: string

  @ApiProperty({ minLength: 12, maxLength: 256, writeOnly: true })
  @IsString()
  @Length(12, 256)
  @MaxLength(256)
  password!: string
}
