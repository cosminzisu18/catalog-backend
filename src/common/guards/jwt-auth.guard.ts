import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_INACTIVE_DIRECTOR_KEY } from '../decorators/allow-inactive-director.decorator';
import { ALLOW_PENDING_PASSWORD_KEY } from '../decorators/allow-pending-password.decorator';
import type { AuthUser } from '../decorators/current-user.decorator';
import { Role } from '../enums/role.enum';

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = (await super.canActivate(context)) as boolean;

    const req = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser; method?: string }>();
    const user = req.user;

    if (
      user?.mustChangePassword &&
      !this.isMarked(context, ALLOW_PENDING_PASSWORD_KEY)
    ) {
      throw new ForbiddenException(
        'Trebuie sa iti schimbi parola temporara inainte de a continua',
      );
    }

    // inactive directors are read-only. Not a global guard: those run
    // before this one, when req.user is still empty
    const isWrite = !READ_METHODS.includes((req.method ?? 'GET').toUpperCase());
    if (
      user?.role === Role.DIRECTOR &&
      !user.isActiveDirector &&
      isWrite &&
      !this.isMarked(context, ALLOW_INACTIVE_DIRECTOR_KEY)
    ) {
      throw new ForbiddenException(
        'Doar directorul activ poate face aceasta actiune',
      );
    }

    return authenticated;
  }

  private isMarked(context: ExecutionContext, key: string): boolean {
    return !!this.reflector.getAllAndOverride<boolean>(key, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}
