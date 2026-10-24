jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { NotFoundException } from '@nestjs/common';
import { GradeType } from '../common/enums/grade-type.enum';
import { StatsService } from './stats.service';

// fake query builder that returns fixed rows
function fakeQb(result: { many?: unknown[]; raw?: unknown[] }) {
  const qb: Record<string, jest.Mock> = {
    getMany: jest.fn(() => Promise.resolve(result.many ?? [])),
    getRawMany: jest.fn(() => Promise.resolve(result.raw ?? [])),
  };
  for (const name of [
    'innerJoin',
    'innerJoinAndSelect',
    'select',
    'addSelect',
    'where',
    'andWhere',
  ]) {
    qb[name] = jest.fn(() => qb);
  }
  return qb;
}

const student = (
  id: number,
  classId: number,
  className: string,
  conductGrade = '10.00',
) => ({
  id,
  firstName: `Elev${id}`,
  lastName: 'Test',
  classId,
  schoolId: 1,
  conductGrade,
  schoolClass: { id: classId, name: className },
});

const grade = (
  studentId: number,
  subjectId: number,
  value: string,
  type = GradeType.NORMAL,
) => ({
  studentId: String(studentId),
  subjectId: String(subjectId),
  subjectName: subjectId === 1 ? 'Matematica' : 'Romana',
  value,
  type,
});

describe('StatsService', () => {
  let students: ReturnType<typeof student>[];
  let grades: ReturnType<typeof grade>[];

  const gradesRepo = {
    createQueryBuilder: jest.fn(() => fakeQb({ raw: grades })),
  };
  const studentsRepo = {
    createQueryBuilder: jest.fn(() => fakeQb({ many: students })),
    findOne: jest.fn(),
  };
  const classesRepo = { find: jest.fn(), findOne: jest.fn() };

  const service = new StatsService(
    gradesRepo as never,
    studentsRepo as never,
    classesRepo as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    students = [
      student(1, 10, '9A'),
      student(2, 10, '9A', '9.00'),
      student(3, 11, '10B'),
      student(4, 11, '10B'),
    ];
    grades = [
      // student 1: math 10, romanian (9, 9, 8 + thesis 7) -> 8 => (10+8+10)/3
      grade(1, 1, '10.00'),
      grade(1, 2, '9.00'),
      grade(1, 2, '9.00'),
      grade(1, 2, '8.00'),
      grade(1, 2, '7.00', GradeType.THESIS),
      // student 2: math 8 and 9 -> 9 (8.5 goes up), conduct 9 => 9.00
      grade(2, 1, '8.00'),
      grade(2, 1, '9.00'),
      // student 3: math 6 => (6 + 10) / 2 = 8.00
      grade(3, 1, '6.00'),
      // student 4 has no grades
    ];
    classesRepo.find.mockResolvedValue([
      { id: 10, name: '9A' },
      { id: 11, name: '10B' },
    ]);
  });

  it('builds a report per student with subject and general averages', () => {
    const [first] = service.buildReports(
      [students[0]] as never,
      grades.map((g) => ({
        ...g,
        studentId: Number(g.studentId),
        subjectId: Number(g.subjectId),
      })),
    );

    expect(first.subjects).toEqual([
      expect.objectContaining({ subjectName: 'Matematica', final: 10 }),
      expect.objectContaining({
        subjectName: 'Romana',
        average: 8.66,
        thesis: 7,
        final: 8,
      }),
    ]);
    // (10 + 8 + 10) / 3 = 9.333 -> 9.33
    expect(first.generalAverage).toBe(9.33);
  });

  it('gives class averages, the best student per class and the school top', async () => {
    const result = await service.classesOverview(1);

    // [class, students, class average, best student id]
    // 9A: (9.33 + 9.00) / 2 = 9.165 -> 9.17
    // 10B: student 4 has no average, so only student 3 counts
    expect(
      result.classes.map((c) => [
        c.className,
        c.studentCount,
        c.average,
        c.best?.studentId,
      ]),
    ).toEqual([
      ['9A', 2, 9.17, 1],
      ['10B', 2, 8, 3],
    ]);
    expect(result.topStudents.map((s) => s.studentId)).toEqual([1, 2, 3]);
    expect(result.topStudents[0]).not.toHaveProperty('subjects');
  });

  it('gives a student their place in the class', async () => {
    students = students.filter((s) => s.classId === 10);
    studentsRepo.findOne.mockResolvedValue(students[1]);

    const stats = await service.forStudentUser(99);

    expect(stats.studentId).toBe(2);
    expect(stats.generalAverage).toBe(9);
    expect(stats.classAverage).toBe(9.17);
    expect(stats.classRank).toBe(2);
    expect(stats.classSize).toBe(2);
  });

  it('ranks the students of one class and averages each subject', async () => {
    students = students.filter((s) => s.classId === 10);
    classesRepo.findOne.mockResolvedValue({ id: 10, name: '9A' });

    const detail = await service.classDetail(1, 10);

    expect(detail.students.map((s) => s.studentId)).toEqual([1, 2]);
    expect(detail.subjects).toEqual([
      // math finals: 10 and 9
      expect.objectContaining({ subjectName: 'Matematica', average: 9.5 }),
      expect.objectContaining({ subjectName: 'Romana', average: 8 }),
    ]);
  });

  it('does not show a class from another school', async () => {
    classesRepo.findOne.mockResolvedValue(null);
    await expect(service.classDetail(1, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("does not show another school's student to a director", async () => {
    studentsRepo.findOne.mockResolvedValue({ ...students[0], schoolId: 2 });
    await expect(service.forStudentInSchool(1, 1)).rejects.toThrow(
      'Elevul nu este in scoala ta',
    );
  });
});
