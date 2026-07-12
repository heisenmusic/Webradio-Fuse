import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload =>
    ctx.switchToHttp().getRequest().user,
);
