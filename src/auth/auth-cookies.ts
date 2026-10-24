import type { CookieOptions, Request, Response } from 'express';
import type { IssuedSession } from './session.service';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

// the refresh token is only sent to the auth routes, not on every request
const ACCESS_PATH = '/api';
const REFRESH_PATH = '/api/auth';

function baseOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true, // not readable from JavaScript, so XSS can't steal it
    secure, // HTTPS only in production
    sameSite: 'strict', // not sent on requests started by other sites
  };
}

export function setAuthCookies(
  res: Response,
  session: IssuedSession,
  secure: boolean,
) {
  res.cookie(ACCESS_COOKIE, session.accessToken, {
    ...baseOptions(secure),
    path: ACCESS_PATH,
    maxAge: session.accessMaxAgeMs,
  });
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...baseOptions(secure),
    path: REFRESH_PATH,
    ...(session.refreshMaxAgeMs ? { maxAge: session.refreshMaxAgeMs } : {}),
  });
}

export function clearAuthCookies(res: Response, secure: boolean) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(secure), path: ACCESS_PATH });
  res.clearCookie(REFRESH_COOKIE, {
    ...baseOptions(secure),
    path: REFRESH_PATH,
  });
}

export function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value ? value : undefined;
}
