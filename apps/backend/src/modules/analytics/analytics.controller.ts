import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBody, ApiExtraModels, ApiOperation, ApiTags } from "@nestjs/swagger"
import type { Request } from "express"

import { AuthService } from "../auth/auth.service.js"
import { AdminSessionGuard } from "../auth/guards/admin-session.guard.js"
import { AnalyticsService } from "./analytics.service.js"
import { AnalyticsPeriodQueryDto } from "./dto/analytics-period-query.dto.js"
import { RecordAnalyticsViewDto } from "./dto/record-analytics-view.dto.js"

@ApiTags("analytics")
@ApiExtraModels(AnalyticsPeriodQueryDto)
@Controller()
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
    @Inject(AuthService) private readonly auth: AuthService
  ) {}

  @Post("analytics/views")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: RecordAnalyticsViewDto })
  @ApiOperation({ summary: "Записать обезличенный просмотр" })
  record(@Body() input: RecordAnalyticsViewDto, @Req() request: Request) {
    const hasBrowserOrigin =
      request.header("origin") !== undefined ||
      request.header("referer") !== undefined
    if (hasBrowserOrigin && !this.auth.isRequestOriginAllowed(request)) {
      throw new ForbiddenException("Источник запроса не разрешён.")
    }
    return this.analytics.recordView(input.type, input.resourceId, request)
  }

  @Get("admin/analytics")
  @UseGuards(AdminSessionGuard)
  @ApiOperation({ summary: "Статистика просмотров для администратора" })
  statistics(@Query() query: AnalyticsPeriodQueryDto) {
    return this.analytics.getStatistics(query.period)
  }
}
