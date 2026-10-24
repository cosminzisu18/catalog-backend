jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  TypeOrmModule: {
    forFeature: jest.fn(),
    forRoot: jest.fn(),
    forRootAsync: jest.fn(),
  },
}));

jest.mock('../subjects/subjects.service', () => ({
  SubjectsService: class SubjectsService {},
}));

jest.mock('../teachers/teachers.service', () => ({
  TeachersService: class TeachersService {},
}));

jest.mock('../reports/reports.service', () => ({
  ReportsService: class ReportsService {},
}));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Absence } from '../absences/entities/absence.entity';
import { GradeType } from '../common/enums/grade-type.enum';
import { ReportType } from '../common/enums/report-type.enum';
import { Grade } from './entities/grade.entity';
import { GradesService } from './grades.service';

describe('GradesService', () => {
  const gradesRepo = {
    exists: jest.fn(),
  };

  const txGrades = {
    create: jest.fn(<T>(x: T) => x),
    save: jest.fn(),
    exists: jest.fn(),
  };
  const txAbsences = { exists: jest.fn() };
  const txStudents = { findOne: jest.fn() };

  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Grade) return txGrades;
      if (entity === Absence) return txAbsences;
      return txStudents;
    }),
  };

  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    ),
  };

  const subjectsService = {
    canTeacherGradeStudent: jest.fn(),
    getByIdOrFail: jest.fn(),
  };

  const teachersService = {
    getByUserIdOrFail: jest.fn(),
  };

  const reportsService = {
    create: jest.fn(),
  };

  const studentsService = {
    getByIdOrFail: jest.fn(),
  };

  const timetableService = {
    assertTeacherInLessonNow: jest.fn(),
  };

  const service = new GradesService(
    gradesRepo as never,
    subjectsService as never,
    teachersService as never,
    studentsService as never,
    reportsService as never,
    timetableService as never,
    dataSource as never,
  );

  const subject = { id: 3, schoolId: 1, name: 'Matematica' };
  const student = {
    id: 1,
    firstName: 'Ana',
    lastName: 'Pop',
    className: '9A',
    classId: 4,
    schoolId: 1,
  };
  const gradeInput = {
    studentId: 1,
    subjectId: 3,
    value: 9,
    gradedOn: '14-10-2026',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    teachersService.getByUserIdOrFail.mockResolvedValue({
      id: 7,
      schoolId: 1,
      firstName: 'Ion',
      lastName: 'Pop',
    });
    subjectsService.getByIdOrFail.mockResolvedValue(subject);
    subjectsService.canTeacherGradeStudent.mockResolvedValue(true);
    studentsService.getByIdOrFail.mockResolvedValue(student);
    timetableService.assertTeacherInLessonNow.mockResolvedValue({
      inLesson: true,
    });
    gradesRepo.exists.mockResolvedValue(false);
    txGrades.exists.mockResolvedValue(false);
    txAbsences.exists.mockResolvedValue(false);
  });

  describe('createByTeacher', () => {
    it('rejects grade when teacher cannot grade student/subject', async () => {
      subjectsService.canTeacherGradeStudent.mockResolvedValue(false);

      await expect(
        service.createByTeacher(10, gradeInput),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects impossible calendar dates', async () => {
      await expect(
        service.createByTeacher(10, { ...gradeInput, gradedOn: '31-02-2026' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects dates in the future', async () => {
      await expect(
        service.createByTeacher(10, { ...gradeInput, gradedOn: '01-01-2099' }),
      ).rejects.toThrow('Nu poti pune note cu o data din viitor');
    });

    it("checks the lesson against the student's class", async () => {
      timetableService.assertTeacherInLessonNow.mockRejectedValue(
        new BadRequestException('Nu esti la ora'),
      );

      await expect(
        service.createByTeacher(10, gradeInput),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(timetableService.assertTeacherInLessonNow).toHaveBeenCalledWith(
        7,
        3,
        4,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('allows only one thesis per subject in a school year', async () => {
      gradesRepo.exists.mockResolvedValue(true);

      await expect(
        service.createByTeacher(10, { ...gradeInput, type: GradeType.THESIS }),
      ).rejects.toThrow('Elevul are deja o teza la aceasta materie');
      // the thesis check looks at the whole school year of the grade
      const [query] = gradesRepo.exists.mock.calls[0] as [
        { where: { type: GradeType; gradedOn: { value: string[] } } },
      ];
      expect(query.where.type).toBe(GradeType.THESIS);
      expect(query.where.gradedOn.value).toEqual(['2026-09-01', '2027-08-31']);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('saves a thesis with its type', async () => {
      txGrades.save.mockImplementation(<T>(x: T) =>
        Promise.resolve({ id: 2, ...x }),
      );

      const result = await service.createByTeacher(10, {
        ...gradeInput,
        type: GradeType.THESIS,
      });

      expect(result.type).toBe(GradeType.THESIS);
      const [report] = reportsService.create.mock.calls[0] as [
        { description: string },
      ];
      expect(report.description).toContain('Teza 9');
    });

    it('rejects second grade on same day', async () => {
      txGrades.exists.mockResolvedValue(true);

      await expect(
        service.createByTeacher(10, gradeInput),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(txGrades.save).not.toHaveBeenCalled();
    });

    it('rejects a grade when the student was absent that day', async () => {
      txAbsences.exists.mockResolvedValue(true);

      await expect(service.createByTeacher(10, gradeInput)).rejects.toThrow(
        'Elevul are absenta la aceasta materie in ziua respectiva',
      );
      expect(txGrades.save).not.toHaveBeenCalled();
    });

    it('locks the student row before checking the day', async () => {
      txGrades.save.mockImplementation(<T>(x: T) =>
        Promise.resolve({ id: 3, ...x }),
      );

      await service.createByTeacher(10, gradeInput);

      expect(txStudents.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('saves grade and report in the same transaction', async () => {
      txGrades.save.mockResolvedValue({
        id: 1,
        studentId: 1,
        subjectId: 3,
        teacherId: 7,
        schoolId: 1,
        value: 9,
        gradedOn: '2026-10-14',
      });

      const result = await service.createByTeacher(10, gradeInput);

      expect(result.gradedOn).toBe('14-10-2026');
      expect(result.value).toBe(9);
      expect(result.studentName).toBe('Ana Pop');
      expect(reportsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: ReportType.GRADE_CREATE }),
        manager,
      );
    });
  });
});
