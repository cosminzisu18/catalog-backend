import {
  ageOn,
  isValidDate,
  schoolYearStart,
  toDbDate,
  toDisplayDate,
} from './date.util';

describe('date.util', () => {
  it('converts dd-mm-yyyy to db format', () => {
    expect(toDbDate('14-10-2026')).toBe('2026-10-14');
  });

  it('converts db date to display format', () => {
    expect(toDisplayDate('2026-10-14')).toBe('14-10-2026');
  });

  it('rejects impossible dates', () => {
    expect(isValidDate('14-10-2026')).toBe(true);
    expect(isValidDate('29-02-2028')).toBe(true);
    expect(isValidDate('31-02-2026')).toBe(false);
    expect(isValidDate('29-02-2027')).toBe(false);
  });

  it('counts full years of age', () => {
    expect(ageOn('2010-10-23', '2026-10-23')).toBe(16);
    expect(ageOn('2010-10-24', '2026-10-23')).toBe(15);
    expect(ageOn('2010-12-01', '2026-10-23')).toBe(15);
  });

  it('starts the school year on 1 September', () => {
    expect(schoolYearStart('2026-10-23')).toBe('2026-09-01');
    expect(schoolYearStart('2026-09-01')).toBe('2026-09-01');
    expect(schoolYearStart('2027-03-15')).toBe('2026-09-01');
    expect(schoolYearStart('2026-08-31')).toBe('2025-09-01');
  });
});
