import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { parseDuration } from '../common/utils/duration.util';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

export type AccessTokenPayload = {
  sub: number;
  role: string;
  schoolId: number | null;
  ver: number;
};

export type IssuedSession = {
  accessToken: string;
  accessMaxAgeMs: number;
  refreshToken: string;
  // null = session cookie (gone when the browser closes)
  refreshMaxAgeMs: number | null;
};

type RotateResult =
  | { ok: true; user: User; session: IssuedSession }
  | { ok: false; revokeFamily?: string };

// two tabs refreshing at the same time send the same token;
// inside this window the second request is not treated as theft
const REUSE_GRACE_MS = 30_000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionService {
  private readonly accessTtlMs: number;
  private readonly rememberTtlMs: number;
  private readonly sessionTtlMs: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.accessTtlMs = parseDuration(
      config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    );
    this.rememberTtlMs = parseDuration(
      config.get<string>('REFRESH_REMEMBER_TTL', '7d'),
    );
    this.sessionTtlMs = parseDuration(
      config.get<string>('REFRESH_SESSION_TTL', '12h'),
    );
  }

  async start(user: User, rememberMe: boolean): Promise<IssuedSession> {
    const repo = this.dataSource.getRepository(RefreshToken);
    // cleanup: drop this user's expired tokens
    await repo
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId AND expires_at < :now', {
        userId: user.id,
        now: new Date(),
      })
      .execute();

    return this.issue(this.dataSource.manager, user, randomUUID(), rememberMe);
  }

  // swaps the refresh token for a new one (rotation). A used token that
  // shows up again after the grace window was probably copied, so the
  // whole family is revoked, including the "real" session.
  async rotate(
    rawToken: string,
  ): Promise<{ user: User; session: IssuedSession } | null> {
    const result = await this.dataSource.transaction(
      async (manager): Promise<RotateResult> => {
        const token = await manager.getRepository(RefreshToken).findOne({
          where: { tokenHash: hashToken(rawToken) },
          lock: { mode: 'pessimistic_write' },
        });
        const now = Date.now();

        if (!token || token.revokedAt || token.expiresAt.getTime() <= now) {
          return { ok: false };
        }

        const user = await manager
          .getRepository(User)
          .findOne({ where: { id: token.userId } });
        if (
          !user ||
          !user.isActive ||
          user.tokenVersion !== token.tokenVersion
        ) {
          return { ok: false, revokeFamily: token.familyId };
        }

        if (token.usedAt) {
          if (now - token.usedAt.getTime() > REUSE_GRACE_MS) {
            return { ok: false, revokeFamily: token.familyId };
          }
        } else {
          token.usedAt = new Date(now);
          await manager.getRepository(RefreshToken).save(token);
        }

        const session = await this.issue(
          manager,
          user,
          token.familyId,
          token.rememberMe,
        );
        return { ok: true, user, session };
      },
    );

    if (result.ok) {
      return { user: result.user, session: result.session };
    }
    // revoke after the transaction, so a rollback does not undo it
    if (result.revokeFamily) {
      await this.revokeFamily(result.revokeFamily);
    }
    return null;
  }

  async end(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const token = await this.dataSource
      .getRepository(RefreshToken)
      .findOne({ where: { tokenHash: hashToken(rawToken) } });
    if (token) {
      await this.revokeFamily(token.familyId);
    }
  }

  async isRemembered(rawToken: string | undefined): Promise<boolean> {
    if (!rawToken) return false;
    const token = await this.dataSource
      .getRepository(RefreshToken)
      .findOne({ where: { tokenHash: hashToken(rawToken) } });
    return token?.rememberMe ?? false;
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.dataSource
      .getRepository(RefreshToken)
      .update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private async issue(
    manager: EntityManager,
    user: User,
    familyId: string,
    rememberMe: boolean,
  ): Promise<IssuedSession> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      schoolId: user.schoolId,
      ver: user.tokenVersion,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: Math.floor(this.accessTtlMs / 1000),
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const ttl = rememberMe ? this.rememberTtlMs : this.sessionTtlMs;
    const repo = manager.getRepository(RefreshToken);
    await repo.save(
      repo.create({
        userId: user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        tokenVersion: user.tokenVersion,
        rememberMe,
        expiresAt: new Date(Date.now() + ttl),
      }),
    );

    return {
      accessToken,
      accessMaxAgeMs: this.accessTtlMs,
      refreshToken,
      refreshMaxAgeMs: rememberMe ? ttl : null,
    };
  }
}
