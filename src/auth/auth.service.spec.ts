jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  TypeOrmModule: {
    forFeature: jest.fn(),
    forRoot: jest.fn(),
    forRootAsync: jest.fn(),
  },
}));

jest.mock('../users/users.service', () => ({
  UsersService: class UsersService {},
}));

jest.mock('../schools/schools.service', () => ({
  SchoolsService: class SchoolsService {},
}));

jest.mock('../directors/directors.service', () => ({
  DirectorsService: class DirectorsService {},
}));

jest.mock('./session.service', () => ({
  SessionService: class SessionService {},
}));

import {
  BadRequestException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    verifyCredentials: jest.fn(),
    validatePassword: jest.fn(),
    getByIdOrFail: jest.fn(),
    updatePassword: jest.fn(),
  };

  const schoolsService = {
    findBySlug: jest.fn(),
    getByIdOrFail: jest.fn(),
  };

  const directorsService = {
    findByUserId: jest.fn(),
  };

  const session = { accessToken: 'a', refreshToken: 'r' };
  const sessionService = {
    start: jest.fn().mockResolvedValue(session),
    rotate: jest.fn(),
    end: jest.fn(),
    isRemembered: jest.fn(),
  };

  const resetTokensRepo = {
    update: jest.fn(),
    save: jest.fn(),
    create: jest.fn(<T>(x: T) => x),
    findOne: jest.fn(),
  };

  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'CORS_ORIGIN' ? 'http://localhost:3000' : '',
    ),
    get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'test' : undefined)),
  };

  const service = new AuthService(
    usersService as never,
    schoolsService as never,
    directorsService as never,
    sessionService as never,
    resetTokensRepo as never,
    config as never,
  );

  const school = { id: 1, slug: 'mircea-eliade', name: 'Mircea Eliade' };

  beforeEach(() => {
    schoolsService.getByIdOrFail.mockResolvedValue({
      ...school,
      directorUserId: 1,
    });
  });

  function user(overrides: Record<string, unknown> = {}) {
    return {
      id: 2,
      email: 'prof@test.ro',
      role: Role.TEACHER,
      schoolId: 1,
      isActive: true,
      mustChangePassword: false,
      tokenVersion: 0,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    schoolsService.findBySlug.mockResolvedValue(school);
    schoolsService.getByIdOrFail.mockResolvedValue(school);
    sessionService.start.mockResolvedValue(session);
  });

  it('blocks teachers on standard login', async () => {
    usersService.verifyCredentials.mockResolvedValue(user());

    await expect(
      service.loginDirector({ email: 'prof@test.ro', password: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessionService.start).not.toHaveBeenCalled();
  });

  it('blocks directors on institution login', async () => {
    usersService.verifyCredentials.mockResolvedValue(
      user({ id: 1, role: Role.DIRECTOR }),
    );

    await expect(
      service.loginInstitution('mircea-eliade', {
        email: 'dir@test.ro',
        password: 'x',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects inactive accounts with the generic message', async () => {
    usersService.verifyCredentials.mockResolvedValue(user({ isActive: false }));

    await expect(
      service.loginInstitution('mircea-eliade', {
        email: 'prof@test.ro',
        password: 'x',
      }),
    ).rejects.toThrow('Email sau parola incorecta');
  });

  it('does not reveal accounts from another school', async () => {
    usersService.verifyCredentials.mockResolvedValue(user({ schoolId: 99 }));

    await expect(
      service.loginInstitution('mircea-eliade', {
        email: 'prof@test.ro',
        password: 'x',
      }),
    ).rejects.toThrow('Email sau parola incorecta');
  });

  it('starts a session and returns only the public profile', async () => {
    usersService.verifyCredentials.mockResolvedValue(
      user({ mustChangePassword: true }),
    );

    const result = await service.loginInstitution('mircea-eliade', {
      email: 'prof@test.ro',
      password: 'Parola1!Strong',
      rememberMe: true,
    });

    expect(sessionService.start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
      true,
    );
    expect(result.session).toBe(session);
    expect(result.user).toEqual({
      id: 2,
      email: 'prof@test.ro',
      role: Role.TEACHER,
      schoolId: 1,
      mustChangePassword: true,
      mustCompleteProfile: false,
      schoolSlug: 'mircea-eliade',
      schoolName: 'Mircea Eliade',
      isActiveDirector: false,
    });
  });

  it('rejects unknown institution slug', async () => {
    schoolsService.findBySlug.mockResolvedValue(null);

    await expect(
      service.loginInstitution('lipsa', { email: 'a@b.ro', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.verifyCredentials).not.toHaveBeenCalled();
  });

  it('rejects a refresh without a valid token', async () => {
    sessionService.rotate.mockResolvedValue(null);

    await expect(service.refresh('furat')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.refresh(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  describe('changePassword', () => {
    const dto = {
      currentPassword: 'Parola1!Strong',
      newPassword: 'Parola2!Strong',
    };

    it('answers 400 (not 401) for a wrong current password', async () => {
      usersService.getByIdOrFail.mockResolvedValue(user());
      usersService.validatePassword.mockResolvedValue(false);

      await expect(
        service.changePassword(2, dto, 'refresh'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('refuses to reuse the current password', async () => {
      usersService.getByIdOrFail.mockResolvedValue(user());
      usersService.validatePassword.mockResolvedValue(true);

      await expect(
        service.changePassword(
          2,
          { ...dto, newPassword: dto.currentPassword },
          'refresh',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ends the old session and starts a new one with the same remember flag', async () => {
      usersService.getByIdOrFail.mockResolvedValue(user());
      usersService.validatePassword.mockResolvedValue(true);
      sessionService.isRemembered.mockResolvedValue(true);

      await service.changePassword(2, dto, 'refresh');

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        2,
        dto.newPassword,
      );
      expect(sessionService.end).toHaveBeenCalledWith('refresh');
      expect(sessionService.start).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2 }),
        true,
      );
    });
  });

  describe('forgotPassword', () => {
    it('gives the same answer for an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nu@exista.ro' });

      expect(result.devResetUrl).toBeUndefined();
      expect(resetTokensRepo.save).not.toHaveBeenCalled();
    });

    it('cancels old links and stores only the hash of the new token', async () => {
      usersService.findByEmail.mockResolvedValue(user());

      const result = await service.forgotPassword({ email: 'prof@test.ro' });

      expect(resetTokensRepo.update).toHaveBeenCalled();
      const [[saved]] = resetTokensRepo.save.mock.calls as [
        [{ tokenHash: string }],
      ];
      const rawToken = new URL(result.devResetUrl!).searchParams.get('token');
      expect(saved.tokenHash).toHaveLength(64);
      expect(saved.tokenHash).not.toBe(rawToken);
    });
  });

  describe('forgotPassword in production', () => {
    it('does not return or log the reset link', async () => {
      const prodConfig = {
        getOrThrow: () => 'http://localhost:3000',
        get: (key: string) => (key === 'NODE_ENV' ? 'production' : undefined),
      };
      const prodService = new AuthService(
        usersService as never,
        schoolsService as never,
        directorsService as never,
        sessionService as never,
        resetTokensRepo as never,
        prodConfig as never,
      );
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      usersService.findByEmail.mockResolvedValue(user());

      const result = await prodService.forgotPassword({
        email: 'prof@test.ro',
      });

      expect(result).not.toHaveProperty('devResetUrl');
      expect(log).not.toHaveBeenCalled();
      expect(resetTokensRepo.save).toHaveBeenCalled();
      log.mockRestore();
    });
  });

  describe('resetPassword', () => {
    const dto = { token: 'x'.repeat(43), newPassword: 'NouaParola1!' };

    it('rejects an unknown or expired link', async () => {
      resetTokensRepo.findOne.mockResolvedValue(null);

      await expect(service.resetPassword(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('does not reset twice when the link was used at the same time', async () => {
      resetTokensRepo.findOne.mockResolvedValue({ id: 3, userId: 2 });
      resetTokensRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.resetPassword(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('marks the link as used and changes the password', async () => {
      resetTokensRepo.findOne.mockResolvedValue({ id: 3, userId: 2 });
      resetTokensRepo.update.mockResolvedValue({ affected: 1 });

      await service.resetPassword(dto);

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        2,
        dto.newPassword,
        false,
      );
    });
  });
});
