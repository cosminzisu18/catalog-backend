import { GradeType } from '../enums/grade-type.enum';

// ROFUIP art. 109. Without a thesis: mean rounded to a whole number
// (.50 goes up). With a thesis: (3 * M + thesis) / 4, where M is the
// mean cut to 2 decimals. Math is done in hundredths to avoid float errors.

export type GradeInput = { value: number | string; type: GradeType };

export type SubjectAverage = {
  gradeCount: number;
  average: number | null;
  thesis: number | null;
  final: number | null;
};

function toHundredths(value: number | string): number {
  return Math.round(Number(value) * 100);
}

export function truncatedMean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + toHundredths(v), 0);
  return Math.floor(sum / values.length) / 100;
}

function roundHalfUp(sum: number, count: number): number {
  return Math.floor((2 * sum + count) / (2 * count));
}

export function subjectAverage(grades: GradeInput[]): SubjectAverage {
  const normal = grades
    .filter((g) => g.type !== GradeType.THESIS)
    .map((g) => Number(g.value));
  const thesisGrade = grades.find((g) => g.type === GradeType.THESIS);
  const thesis = thesisGrade ? Number(thesisGrade.value) : null;

  if (normal.length === 0) {
    // a thesis alone is not enough to close the average
    return { gradeCount: grades.length, average: null, thesis, final: null };
  }

  const average = truncatedMean(normal)!;
  let final: number;
  if (thesis === null) {
    const sum = normal.reduce((acc, v) => acc + toHundredths(v), 0);
    final = roundHalfUp(sum, 100 * normal.length);
  } else {
    const weighted = 3 * toHundredths(average) + toHundredths(thesis);
    final = roundHalfUp(weighted, 400);
  }

  return { gradeCount: grades.length, average, thesis, final };
}

export function roundedMean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + toHundredths(v), 0);
  return roundHalfUp(sum, values.length) / 100;
}

// conduct counts like a subject
export function generalAverage(
  subjectFinals: (number | null)[],
  conductGrade: number | string,
): number | null {
  const finals = subjectFinals.filter((f): f is number => f !== null);
  if (finals.length === 0) return null;
  return roundedMean([...finals, Number(conductGrade)]);
}
