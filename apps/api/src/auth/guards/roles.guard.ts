import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth.service';

const ROLE_RANK: Record<string, number> = {
  VIEWER: 0,
  SUPPORT: 1,
  MANAGER: 2,
  TENANT_ADMIN: 3,
  SUPER_ADMIN: 4,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AccessTokenPayload }>();
    if (!user) throw new ForbiddenException('Sem contexto de usuário');

    const rank = ROLE_RANK[user.role] ?? -1;
    const ok = required.some((r) => rank >= (ROLE_RANK[r] ?? Infinity));
    if (!ok) throw new ForbiddenException('Permissão insuficiente');
    return true;
  }
}
