import { parseDuration } from '../common/utils/duration.util';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const valid = {
    DB_HOST: '127.0.0.1',
    DB_USER: 'root',
    DB_NAME: 'catalog_digital',
    JWT_SECRET: 'x'.repeat(32),
    CORS_ORIGIN: 'http://localhost:3000',
  };

  it('accepts a complete configuration', () => {
    expect(validateEnv(valid)).toBe(valid);
  });

  it('refuses a short JWT secret', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'secret' })).toThrow(
      'JWT_SECRET',
    );
  });

  it('refuses missing values and bad durations', () => {
    expect(() => validateEnv({ ...valid, DB_HOST: '' })).toThrow('DB_HOST');
    expect(() =>
      validateEnv({ ...valid, JWT_ACCESS_EXPIRES_IN: '15 minute' }),
    ).toThrow('JWT_ACCESS_EXPIRES_IN');
  });
});

describe('parseDuration', () => {
  it('converts s/m/h/d to milliseconds', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('15m')).toBe(900_000);
    expect(parseDuration('12h')).toBe(43_200_000);
    expect(parseDuration('7d')).toBe(604_800_000);
  });
});
