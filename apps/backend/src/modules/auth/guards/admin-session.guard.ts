import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import type { Request } from "express"

import { AuthService } from "../auth.service.js"
import type { AuthenticatedRequest } from "../auth.types.js"

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>()
    const session = await this.auth.authenticate(request)
    if (!session) {
      throw new UnauthorizedException("Требуется вход администратора.")
    }

    ;(request as AuthenticatedRequest).adminSession = session
    return true
  }
}
