// dd-mm-yyyy -> yyyy-mm-dd (MariaDB DATE)
export function toDbDate(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

// yyyy-mm-dd -> dd-mm-yyyy
export function toDisplayDate(yyyyMmDd: string): string {
  const raw = String(yyyyMmDd).slice(0, 10);
  const [yyyy, mm, dd] = raw.split('-');
  return `${dd}-${mm}-${yyyy}`;
}

// the DTO regex lets 31-02 through, so check that the date really exists
export function isValidDate(ddmmyyyy: string): boolean {
  const [dd, mm, yyyy] = ddmmyyyy.split('-').map(Number);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return (
    d.getUTCFullYear() === yyyy &&
    d.getUTCMonth() === mm - 1 &&
    d.getUTCDate() === dd
  );
}

export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = today.slice(0, 10).split('-').map(Number);
  const hadBirthday = tm > bm || (tm === bm && td >= bd);
  return ty - by - (hadBirthday ? 0 : 1);
}

// school year starts on 1 September
export function schoolYearStart(today: string): string {
  const [year, month] = today.slice(0, 10).split('-').map(Number);
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-09-01`;
}
