import { ApiProperty } from "@nestjs/swagger"
import { QUALIFICATION_COMPLETION_LIMITS } from "@mcsr-sabinsk/shared"
import { IsIn, IsInt } from "class-validator"

export class QualificationCompletionLimitDto {
  @ApiProperty({
    enum: QUALIFICATION_COMPLETION_LIMITS,
    description: "Настроенное в Ranked-матче максимальное количество финишей.",
    example: 12,
  })
  @IsInt()
  @IsIn(QUALIFICATION_COMPLETION_LIMITS)
  completionLimit!: (typeof QUALIFICATION_COMPLETION_LIMITS)[number]
}
