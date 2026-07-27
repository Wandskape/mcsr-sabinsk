import { ApiProperty } from "@nestjs/swagger"
import { IsInt, IsString, Matches, MaxLength, Min } from "class-validator"

export class SetTournamentCoverDto {
  @ApiProperty({ example: "covers/7b1d2c2c-39ba-4d1e-b568-cover.webp" })
  @IsString()
  @MaxLength(512)
  @Matches(/^covers\/[a-zA-Z0-9._-]+$/)
  objectKey!: string

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number
}
