import { ApiProperty } from "@nestjs/swagger"
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
} from "class-validator"

import { MINECRAFT_IDENTIFIER_PATTERN } from "./resolve-ranked-user.dto.js"

export class PreviewRegistrationsDto {
  @ApiProperty({ example: ["Player1", "Player2"], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(MINECRAFT_IDENTIFIER_PATTERN, { each: true })
  nicknames!: string[]
}
