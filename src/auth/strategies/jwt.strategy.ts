import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { SchoolsService } from '../../schools/schools.service';
import { UsersService } from '../../users/users.service';
import { ACCESS_COOKIE, readCookie } from '../auth-cookies';
import type { AccessTokenPayload } from '../session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
    private readonly schoolsService: SchoolsService,
  ) {
    super({
      // the token is read only from the httpOnly cookie, never from a header
      jwtFromRequest: (req: Request) => readCookie(req, ACCESS_COOKIE) ?? null,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  // the user is loaded from the DB on every request, so a disabled account
  // or a changed password (different tokenVersion) takes effect right away
  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive || user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('Sesiune invalida');
    }

    let isActiveDirector = false;
    if (user.role === Role.DIRECTOR && user.schoolId) {
      const school = await this.schoolsService.getByIdOrFail(user.schoolId);
      isActiveDirector = school.directorUserId === user.id;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      mustChangePassword: user.mustChangePassword,
      isActiveDirector,
    };
  }
}
