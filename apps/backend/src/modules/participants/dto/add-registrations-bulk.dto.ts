import { ApiProperty } from "@nestjs/swagger"
import { IsInt, Min } from "class-validator"

import { PreviewRegistrationsDto } from "./preview-registrations.dto.js"

export class AddRegistrationsBulkDto extends PreviewRegistrationsDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedDivisionVersion!: number
}
