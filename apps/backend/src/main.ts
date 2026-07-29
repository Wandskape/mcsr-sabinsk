import "reflect-metadata"

import { Logger, ValidationPipe } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import cookieParser from "cookie-parser"
import type { NextFunction, Request, Response } from "express"
import helmet from "helmet"

import { AppModule } from "./app.module.js"
import { ApiExceptionFilter } from "./common/filters/api-exception.filter.js"
import {
  httpLogPayload,
  resolveRequestId,
} from "./common/observability/http-observability.js"
import { securityHeaders } from "./config/security.js"

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })
  const config = app.get(ConfigService)
  const isProduction = config.getOrThrow<string>("NODE_ENV") === "production"
  const httpLogger = new Logger("HTTP")
  const mediaOrigin = new URL(
    config.get<string>("S3_PUBLIC_BASE_URL") ??
      config.getOrThrow<string>("S3_ENDPOINT")
  ).origin

  app.use(helmet(securityHeaders({ isProduction, mediaOrigin })))
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader(
      "permissions-policy",
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()"
    )
    next()
  })
  app.use(cookieParser())
  app.setGlobalPrefix("api/v1")
  app.getHttpAdapter().getInstance().set("trust proxy", "loopback")
  app.enableShutdownHooks()
  app.enableCors({
    origin: config.getOrThrow<string>("FRONTEND_ORIGIN"),
    credentials: true,
    exposedHeaders: ["content-disposition"],
  })
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint()
    const requestId = resolveRequestId(request.header("x-request-id"))
    response.locals.requestId = requestId
    response.setHeader("x-request-id", requestId)
    response.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
      httpLogger.log(
        JSON.stringify(
          httpLogPayload({
            request,
            requestId,
            statusCode: response.statusCode,
            durationMs,
          })
        )
      )
    })
    next()
  })
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    })
  )
  app.useGlobalFilters(new ApiExceptionFilter())

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("MCSR Сабинск API")
      .setDescription("REST API турниров MCSR Сабинск")
      .setVersion("1.0")
      .addCookieAuth(config.getOrThrow<string>("SESSION_COOKIE_NAME"))
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup("api/docs", app, document)
  }

  await app.listen(config.getOrThrow<number>("PORT"), "0.0.0.0")
}

void bootstrap()
