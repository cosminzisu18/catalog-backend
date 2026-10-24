import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { originCheck } from './origin-check.middleware';

describe('originCheck', () => {
  const check = originCheck('http://localhost:3000');

  function run(method: string, origin?: string) {
    const next = jest.fn();
    const req = { method, headers: origin ? { origin } : {} } as Request;
    check(req, {} as never, next);
    return next;
  }

  it('lets through the frontend origin', () => {
    expect(run('POST', 'http://localhost:3000')).toHaveBeenCalledWith();
  });

  it('blocks state-changing requests from another origin', () => {
    const next = run('POST', 'https://evil.example');
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenException));
  });

  it('ignores safe methods and requests without Origin', () => {
    expect(run('GET', 'https://evil.example')).toHaveBeenCalledWith();
    expect(run('DELETE')).toHaveBeenCalledWith();
  });
});
