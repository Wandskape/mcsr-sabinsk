import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common"

import { AuthService } from "../auth.service.js"
import type { AuthenticatedRequest } from "../auth.types.js"

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!this.auth.isCsrfRequestValid(request)) {
      throw new ForbiddenException("Недействительный CSRF-токен.")
    }
    return true
  }
}
