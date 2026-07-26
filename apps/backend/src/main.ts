import "reflect-metadata"

import { randomUUID } from "node:crypto"

import { ValidationPipe } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import type { NextFunction, Request, Response } from "express"

import { AppModule } from "./app.module.js"
import { ApiExceptionFilter } from "./common/filters/api-exception.filter.js"

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })
  const config = app.get(ConfigService)

  app.setGlobalPrefix("api/v1")
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
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup("api/docs", app, document)

  await app.listen(config.getOrThrow<number>("PORT"), "0.0.0.0")
}

void bootstrap()
