import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthUser } from './current-user.decorator';

export const SchoolId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const { user } = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user?.schoolId) {
      throw new ForbiddenException('Contul nu este asociat unei scoli');
    }
    return user.schoolId;
  },
);
