import { ApiProperty } from "@nestjs/swagger"
import { IsString, Matches, MaxLength } from "class-validator"

export const MINECRAFT_IDENTIFIER_PATTERN =
  /^(?:[A-Za-z0-9_]{1,32}|[0-9a-fA-F]{32})$/

export class ResolveRankedUserDto {
  @ApiProperty({ example: "Feinberg" })
  @IsString()
  @MaxLength(64)
  @Matches(MINECRAFT_IDENTIFIER_PATTERN)
  identifier!: string
}
