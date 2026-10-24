import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { hashToken, SessionService } from './session.service';

describe('SessionService', () => {
  const tokensRepo = {
    findOne: jest.fn(),
    save: jest.fn(<T>(x: T) => Promise.resolve(x)),
    create: jest.fn(<T>(x: T) => x),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      delete: () => ({
        where: () => ({ execute: jest.fn() }),
      }),
    })),
  };
  const usersRepo = { findOne: jest.fn() };

  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === User ? usersRepo : tokensRepo,
    ),
  };
  const dataSource = {
    manager,
    getRepository: jest.fn((entity: unknown) =>
      entity === User ? usersRepo : tokensRepo,
    ),
    transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    ),
  };
  const jwtService = { sign: jest.fn().mockReturnValue('access-jwt') };
  const config = {
    get: jest.fn((_key: string, fallback: string) => fallback),
  };

  const service = new SessionService(
    jwtService as never,
    dataSource as never,
    config as never,
  );

  const activeUser = {
    id: 7,
    role: 'TEACHER',
    schoolId: 1,
    isActive: true,
    tokenVersion: 3,
  };

  function storedToken(overrides: Partial<RefreshToken> = {}) {
    return {
      id: 1,
      userId: 7,
      familyId: 'family-1',
      tokenHash: hashToken('raw'),
      tokenVersion: 3,
      rememberMe: true,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      revokedAt: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    usersRepo.findOne.mockResolvedValue(activeUser);
  });

  it('stores only the hash of the refresh token', async () => {
    const session = await service.start(activeUser as never, false);

    const saved = tokensRepo.create.mock.calls[0][0] as RefreshToken;
    expect(saved.tokenHash).toBe(hashToken(session.refreshToken));
    expect(saved.tokenHash).not.toBe(session.refreshToken);
    expect(saved.tokenVersion).toBe(3);
    // without "remember me" the refresh cookie is a session cookie
    expect(session.refreshMaxAgeMs).toBeNull();
    expect(jwtService.sign).toHaveBeenCalledWith(
      { sub: 7, role: 'TEACHER', schoolId: 1, ver: 3 },
      { expiresIn: 15 * 60 },
    );
  });

  it('rotates a valid token: marks it used and issues one in the same family', async () => {
    const token = storedToken();
    tokensRepo.findOne.mockResolvedValue(token);

    const result = await service.rotate('raw');

    expect(result).not.toBeNull();
    expect(token.usedAt).toBeInstanceOf(Date);
    const next = tokensRepo.create.mock.calls[0][0] as RefreshToken;
    expect(next.familyId).toBe('family-1');
    expect(next.rememberMe).toBe(true);
  });

  it('revokes the whole family when a used token is replayed later', async () => {
    tokensRepo.findOne.mockResolvedValue(
      storedToken({ usedAt: new Date(Date.now() - 5 * 60_000) }),
    );

    const result = await service.rotate('raw');

    expect(result).toBeNull();
    expect(tokensRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 'family-1' }),
      expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
    );
  });

  it('tolerates a parallel refresh from another tab (grace window)', async () => {
    tokensRepo.findOne.mockResolvedValue(
      storedToken({ usedAt: new Date(Date.now() - 2_000) }),
    );

    const result = await service.rotate('raw');

    expect(result).not.toBeNull();
    expect(tokensRepo.update).not.toHaveBeenCalled();
  });

  it('rejects tokens issued before a password change (tokenVersion)', async () => {
    tokensRepo.findOne.mockResolvedValue(storedToken({ tokenVersion: 2 }));

    expect(await service.rotate('raw')).toBeNull();
    expect(tokensRepo.update).toHaveBeenCalled();
  });

  it('rejects expired, revoked or unknown tokens', async () => {
    tokensRepo.findOne.mockResolvedValueOnce(
      storedToken({ expiresAt: new Date(Date.now() - 1) }),
    );
    expect(await service.rotate('raw')).toBeNull();

    tokensRepo.findOne.mockResolvedValueOnce(
      storedToken({ revokedAt: new Date() }),
    );
    expect(await service.rotate('raw')).toBeNull();

    tokensRepo.findOne.mockResolvedValueOnce(null);
    expect(await service.rotate('raw')).toBeNull();
  });

  it('rejects tokens of deactivated users', async () => {
    tokensRepo.findOne.mockResolvedValue(storedToken());
    usersRepo.findOne.mockResolvedValue({ ...activeUser, isActive: false });

    expect(await service.rotate('raw')).toBeNull();
  });
});
