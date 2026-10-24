const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

// "15m", "12h", "7d" -> milliseconds. Throws on a bad format.
export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Durata invalida: "${value}" (exemple: 15m, 12h, 7d)`);
  }
  return Number(match[1]) * UNIT_MS[match[2]];
}
