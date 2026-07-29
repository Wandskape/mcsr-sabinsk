import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import {
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger"
import type { Response } from "express"

import type { AuthenticatedRequest } from "../auth/auth.types.js"
import { AdminSessionGuard } from "../auth/guards/admin-session.guard.js"
import { CsrfGuard } from "../auth/guards/csrf.guard.js"
import { ImportTournamentArchiveDto } from "./dto/import-tournament-archive.dto.js"
import { TournamentArchivesService } from "./tournament-archives.service.js"

const archiveInterceptor = FileInterceptor("file", {
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
})

function mutationContext(request: AuthenticatedRequest) {
  return {
    adminUserId: request.adminSession.admin.id,
    requestId: String(request.res?.locals.requestId ?? "unknown"),
  }
}

function sendArchive(
  response: Response,
  archive: { buffer: Buffer; fileName: string }
) {
  response.setHeader("content-type", "application/zip")
  response.setHeader("content-length", archive.buffer.length)
  response.setHeader(
    "content-disposition",
    `attachment; filename="${archive.fileName}"`
  )
  response.setHeader("cache-control", "no-store")
  response.send(archive.buffer)
}

@ApiTags("admin tournament archives")
@ApiExtraModels(ImportTournamentArchiveDto)
@Controller("admin/tournament-archives")
@UseGuards(AdminSessionGuard)
export class TournamentArchivesController {
  constructor(
    @Inject(TournamentArchivesService)
    private readonly archives: TournamentArchivesService
  ) {}

  @Get("export-all")
  @ApiProduces("application/zip")
  @ApiOperation({ summary: "Экспортировать все турниры в один ZIP" })
  async exportAll(@Res() response: Response) {
    sendArchive(response, await this.archives.exportAll())
  }

  @Get(":id/export")
  @ApiProduces("application/zip")
  @ApiOperation({ summary: "Экспортировать один турнир в ZIP" })
  async exportOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Res() response: Response
  ) {
    sendArchive(response, await this.archives.exportOne(id))
  }

  @Post("preview")
  @UseGuards(CsrfGuard)
  @UseInterceptors(archiveInterceptor)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiOperation({ summary: "Проверить архив без изменения данных" })
  preview(@UploadedFile() file: Express.Multer.File) {
    return this.archives.preview(file)
  }

  @Post("import")
  @UseGuards(CsrfGuard)
  @UseInterceptors(archiveInterceptor)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "archiveChecksum"],
      properties: {
        file: { type: "string", format: "binary" },
        archiveChecksum: { type: "string" },
      },
    },
  })
  @ApiOperation({ summary: "Импортировать проверенный архив" })
  import(
    @UploadedFile() file: Express.Multer.File,
    @Body() input: ImportTournamentArchiveDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.archives.import(
      file,
      input.archiveChecksum,
      mutationContext(request)
    )
  }
}
