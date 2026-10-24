import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// extra CSRF protection on top of SameSite=Strict: a browser request that
// changes data must come from the frontend origin. Non-browser clients
// (scripts, tests) send no Origin and have no cookies to steal.
export function originCheck(allowedOrigin: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (SAFE_METHODS.has(req.method) || !origin || origin === allowedOrigin) {
      next();
      return;
    }
    next(new ForbiddenException('Origine nepermisa'));
  };
}
