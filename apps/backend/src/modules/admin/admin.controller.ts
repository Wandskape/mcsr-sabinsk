import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common"
import { ApiOperation, ApiTags } from "@nestjs/swagger"

import type { AuthenticatedRequest } from "../auth/auth.types.js"
import { AdminSessionGuard } from "../auth/guards/admin-session.guard.js"
import { AdminService } from "./admin.service.js"

@ApiTags("admin")
@Controller("admin")
@UseGuards(AdminSessionGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get("overview")
  @ApiOperation({ summary: "Сводка защищённой админ-панели" })
  overview(@Req() request: AuthenticatedRequest) {
    return this.admin.getOverview(request.adminSession.admin.id)
  }
}
