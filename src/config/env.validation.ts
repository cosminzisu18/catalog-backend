import { parseDuration } from '../common/utils/duration.util';

const REQUIRED = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET', 'CORS_ORIGIN'];

const DURATIONS: Record<string, string> = {
  JWT_ACCESS_EXPIRES_IN: '15m',
  REFRESH_REMEMBER_TTL: '7d',
  REFRESH_SESSION_TTL: '12h',
};

// refuse to start with a bad config (weak secret, bad durations)
// instead of failing later on the first login
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  for (const key of REQUIRED) {
    if (typeof config[key] !== 'string' || config[key] === '') {
      errors.push(`${key} lipseste`);
    }
  }

  const secret = config.JWT_SECRET;
  if (typeof secret === 'string' && secret.length < 32) {
    errors.push('JWT_SECRET trebuie sa aiba minim 32 de caractere');
  }

  for (const [key, fallback] of Object.entries(DURATIONS)) {
    const value = config[key];
    try {
      parseDuration(typeof value === 'string' ? value : fallback);
    } catch (err) {
      errors.push(`${key}: ${(err as Error).message}`);
    }
  }

  if (errors.length) {
    throw new Error(`Configuratie invalida:\n- ${errors.join('\n- ')}`);
  }
  return config;
}
