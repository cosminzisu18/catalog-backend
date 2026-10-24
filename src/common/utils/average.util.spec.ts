import { GradeType } from '../enums/grade-type.enum';
import {
  generalAverage,
  roundedMean,
  subjectAverage,
  truncatedMean,
} from './average.util';

const normal = (value: number) => ({ value, type: GradeType.NORMAL });
const thesis = (value: number) => ({ value, type: GradeType.THESIS });

describe('average.util', () => {
  describe('truncatedMean', () => {
    it('cuts to 2 decimals instead of rounding', () => {
      // 26 / 3 = 8.666...
      expect(truncatedMean([9, 9, 8])).toBe(8.66);
    });

    it('works with decimal grades without float errors', () => {
      expect(truncatedMean([9.1, 9.2])).toBe(9.15);
      expect(truncatedMean([0.1 + 0.2, 10])).toBe(5.15);
    });

    it('returns null for no grades', () => {
      expect(truncatedMean([])).toBeNull();
    });
  });

  describe('subjectAverage without a thesis', () => {
    it('rounds the mean to a whole number', () => {
      expect(subjectAverage([normal(7), normal(8), normal(7)]).final).toBe(7);
      expect(subjectAverage([normal(9), normal(10), normal(10)]).final).toBe(
        10,
      );
    });

    it('rounds .50 up, in favor of the student', () => {
      expect(subjectAverage([normal(8), normal(9)]).final).toBe(9);
      expect(subjectAverage([normal(9), normal(10)]).final).toBe(10);
    });

    it('rounds .49 down', () => {
      // 7.49 -> 7
      expect(subjectAverage([normal(7.49)]).final).toBe(7);
    });

    it('matches the ROFUIP example: 58 / 6 = 9.66 -> 10', () => {
      const grades = [10, 10, 10, 9, 10, 9].map(normal);
      const result = subjectAverage(grades);
      expect(result.average).toBe(9.66);
      expect(result.final).toBe(10);
    });
  });

  describe('subjectAverage with a thesis', () => {
    it('uses (3 * M + T) / 4', () => {
      // M = 8.66 (cut), (25.98 + 7) / 4 = 8.245 -> 8
      const result = subjectAverage([
        normal(9),
        normal(9),
        normal(8),
        thesis(7),
      ]);
      expect(result.average).toBe(8.66);
      expect(result.thesis).toBe(7);
      expect(result.final).toBe(8);
    });

    it('rounds .50 up with a thesis too', () => {
      // M = 8, (24 + 10) / 4 = 8.5 -> 9
      expect(subjectAverage([normal(8), thesis(10)]).final).toBe(9);
    });

    it('can lower the average when the thesis is weak', () => {
      // M = 10, (30 + 4) / 4 = 8.5 -> 9
      expect(subjectAverage([normal(10), normal(10), thesis(4)]).final).toBe(9);
    });

    it('does not close the average with only a thesis', () => {
      const result = subjectAverage([thesis(9)]);
      expect(result.final).toBeNull();
      expect(result.thesis).toBe(9);
      expect(result.gradeCount).toBe(1);
    });
  });

  describe('generalAverage', () => {
    it('is the mean of subject averages and conduct, with 2 decimals', () => {
      // (9 + 8 + 10 + 10) / 4 = 9.25
      expect(generalAverage([9, 8, 10], 10)).toBe(9.25);
      // (9 + 10 + 10) / 3 = 9.666... -> 9.67
      expect(generalAverage([9, 10], 10)).toBe(9.67);
    });

    it('skips subjects without a final average', () => {
      expect(generalAverage([9, null], 9)).toBe(9);
    });

    it('is null when no subject has an average', () => {
      expect(generalAverage([null], 10)).toBeNull();
      expect(generalAverage([], 10)).toBeNull();
    });

    it('accepts the conduct grade as a DB decimal string', () => {
      expect(generalAverage([8], '9.00')).toBe(8.5);
    });
  });

  it('roundedMean rounds to 2 decimals', () => {
    expect(roundedMean([1, 1, 2])).toBe(1.33);
    expect(roundedMean([2, 2, 1])).toBe(1.67);
    expect(roundedMean([])).toBeNull();
  });
});
