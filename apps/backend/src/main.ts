import "reflect-metadata"

import { randomUUID } from "node:crypto"

import { ValidationPipe } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import cookieParser from "cookie-parser"
import type { NextFunction, Request, Response } from "express"
import helmet from "helmet"

import { AppModule } from "./app.module.js"
import { ApiExceptionFilter } from "./common/filters/api-exception.filter.js"

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })
  const config = app.get(ConfigService)
  const mediaOrigin = new URL(
    config.get<string>("S3_PUBLIC_BASE_URL") ??
      config.getOrThrow<string>("S3_ENDPOINT")
  ).origin

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", mediaOrigin],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      ...(config.getOrThrow<string>("NODE_ENV") === "production"
        ? {}
        : { hsts: false }),
    })
  )
  app.use(cookieParser())
  app.setGlobalPrefix("api/v1")
  app.getHttpAdapter().getInstance().set("trust proxy", "loopback")
  app.enableShutdownHooks()
  app.enableCors({
    origin: config.getOrThrow<string>("FRONTEND_ORIGIN"),
    credentials: true,
  })
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestIdHeader = request.header("x-request-id")
    const requestId = requestIdHeader?.slice(0, 100) || randomUUID()
    response.locals.requestId = requestId
    response.setHeader("x-request-id", requestId)
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle("MCSR Сабинск API")
    .setDescription("REST API турниров MCSR Сабинск")
    .setVersion("1.0")
    .addCookieAuth(config.getOrThrow<string>("SESSION_COOKIE_NAME"))
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup("api/docs", app, document)

  await app.listen(config.getOrThrow<number>("PORT"), "0.0.0.0")
}

void bootstrap()
