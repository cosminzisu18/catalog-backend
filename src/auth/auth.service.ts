import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { DirectorsService } from '../directors/directors.service';
import { RegisterSchoolDto } from '../schools/dto/register-school.dto';
import { SchoolsService } from '../schools/schools.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { SessionService, type IssuedSession } from './session.service';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_FORGOT_MESSAGE =
  'Daca exista un cont cu acest email, vei primi un link de resetare.';

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type AuthUserView = {
  id: number;
  email: string;
  role: Role;
  schoolId: number | null;
  mustChangePassword: boolean;
  // director without a first/last name; must fill them in first
  mustCompleteProfile: boolean;
  schoolSlug: string | null;
  schoolName: string | null;
  // only the active director can change school data
  isActiveDirector: boolean;
};

export type AuthResult = { user: AuthUserView; session: IssuedSession };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly frontendOrigin: string;
  private readonly isDev: boolean;

  constructor(
    private readonly usersService: UsersService,
    private readonly schoolsService: SchoolsService,
    private readonly directorsService: DirectorsService,
    private readonly sessionService: SessionService,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokensRepo: Repository<PasswordResetToken>,
    config: ConfigService,
  ) {
    this.frontendOrigin = config.getOrThrow<string>('CORS_ORIGIN');
    this.isDev = config.get<string>('NODE_ENV') !== 'production';
  }

  async registerSchool(dto: RegisterSchoolDto): Promise<AuthResult> {
    const { directorUserId } = await this.schoolsService.registerSchool(dto);
    const user = await this.usersService.getByIdOrFail(directorUserId);
    return this.startSession(user, false);
  }

  async loginDirector(dto: LoginDto): Promise<AuthResult> {
    const user = await this.validateCredentials(dto.email, dto.password);
    if (user.role !== Role.DIRECTOR) {
      throw new ForbiddenException(
        'Profesorii si elevii se autentifica din link-ul scolii',
      );
    }
    return this.startSession(user, !!dto.rememberMe);
  }

  // teachers and students log in on /login/:slug
  async loginInstitution(slug: string, dto: LoginDto): Promise<AuthResult> {
    const school = await this.schoolsService.findBySlug(slug);
    if (!school) {
      throw new UnauthorizedException('Scoala nu exista');
    }

    const user = await this.validateCredentials(dto.email, dto.password);

    if (user.role === Role.DIRECTOR) {
      throw new ForbiddenException('Directorul se autentifica din /login');
    }

    // same message as a wrong password, so we don't confirm the email exists
    if (user.schoolId !== school.id) {
      throw new UnauthorizedException('Email sau parola incorecta');
    }

    return this.startSession(user, !!dto.rememberMe);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    const rotated = refreshToken
      ? await this.sessionService.rotate(refreshToken)
      : null;
    if (!rotated) {
      throw new UnauthorizedException('Sesiunea a expirat');
    }
    return {
      user: await this.toView(rotated.user),
      session: rotated.session,
    };
  }

  logout(refreshToken: string | undefined): Promise<void> {
    return this.sessionService.end(refreshToken);
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
    refreshToken: string | undefined,
  ): Promise<AuthResult> {
    const user = await this.usersService.getByIdOrFail(userId);
    const ok = await this.usersService.validatePassword(
      user,
      dto.currentPassword,
    );
    // 400, not 401: the session is fine, only the typed password is wrong
    if (!ok) {
      throw new BadRequestException('Parola curenta este incorecta');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'Parola noua trebuie sa fie diferita de cea curenta',
      );
    }

    // changing the password ends all sessions (tokenVersion++);
    // the current device gets a new session right away
    const rememberMe = await this.sessionService.isRemembered(refreshToken);
    await this.usersService.updatePassword(userId, dto.newPassword);
    await this.sessionService.end(refreshToken);

    const updated = await this.usersService.getByIdOrFail(userId);
    return this.startSession(updated, rememberMe);
  }

  async me(userId: number): Promise<AuthUserView> {
    return this.toView(await this.usersService.getByIdOrFail(userId));
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; devResetUrl?: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      return { message: GENERIC_FORGOT_MESSAGE };
    }

    // cancel older reset links that were not used
    await this.resetTokensRepo.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const rawToken = randomBytes(32).toString('base64url');
    await this.resetTokensRepo.save(
      this.resetTokensRepo.create({
        userId: user.id,
        tokenHash: hashResetToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
        usedAt: null,
      }),
    );

    const resetUrl = `${this.frontendOrigin.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
    // there is no email service yet, so the link is only shown in dev;
    // in production it must never end up in the logs
    if (this.isDev) {
      this.logger.log(`Link reset parola pentru ${user.email}: ${resetUrl}`);
      return { message: GENERIC_FORGOT_MESSAGE, devResetUrl: resetUrl };
    }
    return { message: GENERIC_FORGOT_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = hashResetToken(dto.token);
    const row = await this.resetTokensRepo.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!row) {
      throw new BadRequestException(
        'Linkul de resetare este invalid sau a expirat',
      );
    }

    // mark the token as used first; the "usedAt IS NULL" condition makes
    // sure two requests with the same link cannot both reset the password
    const claimed = await this.resetTokensRepo.update(
      { id: row.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    if (!claimed.affected) {
      throw new BadRequestException(
        'Linkul de resetare este invalid sau a expirat',
      );
    }

    await this.usersService.updatePassword(row.userId, dto.newPassword, false);

    return { message: 'Parola a fost actualizata. Te poti autentifica.' };
  }

  private async validateCredentials(email: string, password: string) {
    const user = await this.usersService.verifyCredentials(email, password);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Email sau parola incorecta');
    }
    return user;
  }

  private async startSession(
    user: User,
    rememberMe: boolean,
  ): Promise<AuthResult> {
    return {
      user: await this.toView(user),
      session: await this.sessionService.start(user, rememberMe),
    };
  }

  private async toView(user: User): Promise<AuthUserView> {
    const school = user.schoolId
      ? await this.schoolsService.getByIdOrFail(user.schoolId)
      : null;

    let mustCompleteProfile = false;
    if (user.role === Role.DIRECTOR) {
      const director = await this.directorsService.findByUserId(user.id);
      mustCompleteProfile =
        !director || !director.firstName.trim() || !director.lastName.trim();
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      mustChangePassword: user.mustChangePassword,
      mustCompleteProfile,
      schoolSlug: school?.slug ?? null,
      schoolName: school?.name ?? null,
      isActiveDirector:
        user.role === Role.DIRECTOR &&
        school != null &&
        school.directorUserId === user.id,
    };
  }
}
