import type { ArgumentsHost } from "@nestjs/common"
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from "@nestjs/common"
import type { Request, Response } from "express"

interface NestErrorResponse {
  error?: string
  message?: string | string[]
  statusCode?: number
}

function extractMessage(response: string | object, fallback: string) {
  if (typeof response === "string") {
    return response
  }

  const nestResponse = response as NestErrorResponse
  if (Array.isArray(nestResponse.message)) {
    return nestResponse.message.join("; ")
  }

  return nestResponse.message ?? fallback
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp()
    const response = context.getResponse<Response>()
    const request = context.getRequest<Request>()
    const isHttpException = exception instanceof HttpException
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR
    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : "Внутренняя ошибка сервера."
    const message = extractMessage(
      exceptionResponse,
      status === HttpStatus.INTERNAL_SERVER_ERROR
        ? "Внутренняя ошибка сервера."
        : "Запрос не выполнен."
    )

    if (!isHttpException) {
      const requestId = String(response.locals.requestId ?? "unknown")
      const error =
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
              stack: exception.stack,
            }
          : { name: "UnknownError", message: String(exception) }
      this.logger.error(
        JSON.stringify({
          event: "unhandled_exception",
          requestId,
          method: request.method,
          path: request.path,
          ...error,
        })
      )
    }

    response.status(status).json({
      error: {
        code: isHttpException ? `HTTP_${status}` : "INTERNAL_SERVER_ERROR",
        message,
        details: {},
        requestId: response.locals.requestId ?? null,
        path: request.originalUrl,
      },
    })
  }
}
