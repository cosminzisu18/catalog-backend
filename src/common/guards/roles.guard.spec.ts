import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { RolesGuard } from './roles.guard';

function mockContext(user?: { role: Role }) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  it('allows when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('allows matching role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.TEACHER]);
    expect(guard.canActivate(mockContext({ role: Role.TEACHER }))).toBe(true);
  });

  it('blocks wrong role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.DIRECTOR]);
    expect(() =>
      guard.canActivate(mockContext({ role: Role.STUDENT })),
    ).toThrow(ForbiddenException);
  });
});
