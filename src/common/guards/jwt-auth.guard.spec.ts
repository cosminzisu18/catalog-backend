import { ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ALLOW_INACTIVE_DIRECTOR_KEY } from '../decorators/allow-inactive-director.decorator';
import { ALLOW_PENDING_PASSWORD_KEY } from '../decorators/allow-pending-password.decorator';
import { Role } from '../enums/role.enum';
import { JwtAuthGuard } from './jwt-auth.guard';

type TestUser = {
  mustChangePassword?: boolean;
  role?: Role;
  isActiveDirector?: boolean;
};

function mockContext(user: TestUser, method = 'GET') {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user, method }),
    }),
  } as never;
}

describe('JwtAuthGuard', () => {
  // route metadata for the current test, read by the fake reflector
  let marked: Record<string, boolean> = {};
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => marked[key]),
  } as unknown as Reflector;

  const guard = new JwtAuthGuard(reflector);

  beforeAll(() => {
    // the passport part is not tested here
    jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockResolvedValue(true);
  });

  beforeEach(() => {
    marked = {};
  });

  it('lets through users with a permanent password', async () => {
    await expect(
      guard.canActivate(mockContext({ mustChangePassword: false })),
    ).resolves.toBe(true);
  });

  it('blocks users with a temporary password', async () => {
    await expect(
      guard.canActivate(mockContext({ mustChangePassword: true })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows routes marked with AllowPendingPassword', async () => {
    marked[ALLOW_PENDING_PASSWORD_KEY] = true;
    await expect(
      guard.canActivate(mockContext({ mustChangePassword: true })),
    ).resolves.toBe(true);
  });

  describe('inactive director', () => {
    const inactive = { role: Role.DIRECTOR, isActiveDirector: false };

    it('can still read data', async () => {
      await expect(
        guard.canActivate(mockContext(inactive, 'GET')),
      ).resolves.toBe(true);
    });

    it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
      'cannot send %s requests',
      async (method) => {
        await expect(
          guard.canActivate(mockContext(inactive, method)),
        ).rejects.toThrow('Doar directorul activ poate face aceasta actiune');
      },
    );

    it('can use routes marked with AllowInactiveDirector', async () => {
      marked[ALLOW_INACTIVE_DIRECTOR_KEY] = true;
      await expect(
        guard.canActivate(mockContext(inactive, 'PATCH')),
      ).resolves.toBe(true);
    });

    it('does not affect the active director or other roles', async () => {
      await expect(
        guard.canActivate(
          mockContext({ role: Role.DIRECTOR, isActiveDirector: true }, 'POST'),
        ),
      ).resolves.toBe(true);
      await expect(
        guard.canActivate(mockContext({ role: Role.TEACHER }, 'POST')),
      ).resolves.toBe(true);
    });
  });
});
