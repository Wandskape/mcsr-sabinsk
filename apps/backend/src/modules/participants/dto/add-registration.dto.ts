import { ApiProperty } from "@nestjs/swagger"
import { IsInt, Min } from "class-validator"

import { ResolveRankedUserDto } from "./resolve-ranked-user.dto.js"

export class AddRegistrationDto extends ResolveRankedUserDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedDivisionVersion!: number
}
