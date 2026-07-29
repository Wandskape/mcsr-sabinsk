import { ApiProperty } from "@nestjs/swagger"
import { IsHash } from "class-validator"

export class ImportTournamentArchiveDto {
  @ApiProperty({
    description: "SHA-256 архива, полученный на этапе preview",
  })
  @IsHash("sha256")
  archiveChecksum!: string
}
