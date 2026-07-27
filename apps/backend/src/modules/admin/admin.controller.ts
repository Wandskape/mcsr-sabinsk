import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiExtraModels, ApiOperation, ApiTags } from "@nestjs/swagger"

import type { AuthenticatedRequest } from "../auth/auth.types.js"
import { AdminSessionGuard } from "../auth/guards/admin-session.guard.js"
import { AdminService } from "./admin.service.js"
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto.js"

@ApiTags("admin")
@ApiExtraModels(ListAuditLogsQueryDto)
@Controller("admin")
@UseGuards(AdminSessionGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get("overview")
  @ApiOperation({ summary: "Сводка защищённой админ-панели" })
  overview(@Req() request: AuthenticatedRequest) {
    return this.admin.getOverview(request.adminSession.admin.id)
  }

  @Get("audit-logs")
  @ApiOperation({ summary: "Журнал административных действий" })
  listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.admin.listAuditLogs(query)
  }

  @Get("audit-logs/:id")
  @ApiOperation({ summary: "Детали административного действия и diff" })
  getAuditLog(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.getAuditLog(id)
  }
}
