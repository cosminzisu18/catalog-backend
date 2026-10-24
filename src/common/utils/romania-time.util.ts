// day: 1 = Monday ... 7 = Sunday (Europe/Bucharest)
const WEEKDAY_TO_NUM: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export type RomaniaClock = {
  dayOfWeek: number;
  time: string; // HH:mm
};

export function getRomaniaClock(date = new Date()): RomaniaClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bucharest',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';

  return {
    dayOfWeek: WEEKDAY_TO_NUM[weekday] ?? 1,
    time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
  };
}

// compares HH:mm strings, both ends included
export function isTimeInRange(
  current: string,
  start: string,
  end: string,
): boolean {
  return current >= start && current <= end;
}

export const DAY_LABELS_RO: Record<number, string> = {
  1: 'Luni',
  2: 'Marti',
  3: 'Miercuri',
  4: 'Joi',
  5: 'Vineri',
  6: 'Sambata',
  7: 'Duminica',
};

// today's date in Romania as yyyy-mm-dd (same format as DATE columns)
export function getRomaniaDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
