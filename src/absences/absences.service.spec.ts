jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('../subjects/subjects.service', () => ({
  SubjectsService: class SubjectsService {},
}));

jest.mock('../teachers/teachers.service', () => ({
  TeachersService: class TeachersService {},
}));

jest.mock('../timetable/timetable.service', () => ({
  TimetableService: class TimetableService {},
}));

jest.mock('../reports/reports.service', () => ({
  ReportsService: class ReportsService {},
}));

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ReportType } from '../common/enums/report-type.enum';
import { getRomaniaDate } from '../common/utils/romania-time.util';
import { Grade } from '../grades/entities/grade.entity';
import { AbsencesService } from './absences.service';
import { Absence } from './entities/absence.entity';

describe('AbsencesService', () => {
  const txAbsences = {
    create: jest.fn(<T>(x: T) => x),
    save: jest.fn(<T>(x: T) => Promise.resolve({ id: 1, ...x })),
    exists: jest.fn(),
    findOne: jest.fn(),
  };
  const txGrades = { exists: jest.fn() };
  const txStudents = { findOne: jest.fn() };

  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Absence) return txAbsences;
      if (entity === Grade) return txGrades;
      return txStudents;
    }),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    ),
  };

  const teachersService = { getByUserIdOrFail: jest.fn() };
  const studentsService = {
    getByIdOrFail: jest.fn(),
    getByUserIdOrFail: jest.fn(),
  };
  const subjectsService = {
    getByIdOrFail: jest.fn(),
    canTeacherGradeStudent: jest.fn(),
  };
  const timetableService = { assertTeacherInLessonNow: jest.fn() };
  const reportsService = { create: jest.fn() };

  const service = new AbsencesService(
    {} as never,
    teachersService as never,
    studentsService as never,
    subjectsService as never,
    timetableService as never,
    reportsService as never,
    dataSource as never,
  );

  const input = { studentId: 1, subjectId: 3 };

  beforeEach(() => {
    jest.clearAllMocks();
    teachersService.getByUserIdOrFail.mockResolvedValue({
      id: 7,
      schoolId: 1,
      firstName: 'Ion',
      lastName: 'Pop',
    });
    subjectsService.getByIdOrFail.mockResolvedValue({
      id: 3,
      schoolId: 1,
      name: 'Matematica',
    });
    studentsService.getByIdOrFail.mockResolvedValue({
      id: 1,
      classId: 4,
      schoolId: 1,
      firstName: 'Ana',
      lastName: 'Pop',
      schoolClass: { name: '9A' },
    });
    subjectsService.canTeacherGradeStudent.mockResolvedValue(true);
    timetableService.assertTeacherInLessonNow.mockResolvedValue({});
    txGrades.exists.mockResolvedValue(false);
    txAbsences.exists.mockResolvedValue(false);
  });

  describe('createByTeacher', () => {
    it('only lets a teacher mark students they teach', async () => {
      subjectsService.canTeacherGradeStudent.mockResolvedValue(false);

      await expect(service.createByTeacher(10, input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it("needs the lesson with the student's class to be happening now", async () => {
      timetableService.assertTeacherInLessonNow.mockRejectedValue(
        new BadRequestException('Nu esti la ora'),
      );

      await expect(service.createByTeacher(10, input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(timetableService.assertTeacherInLessonNow).toHaveBeenCalledWith(
        7,
        3,
        4,
      );
    });

    it('refuses an absence when the student already has a grade that day', async () => {
      txGrades.exists.mockResolvedValue(true);

      await expect(service.createByTeacher(10, input)).rejects.toThrow(
        'Elevul are deja o nota la aceasta materie in ziua respectiva',
      );
      expect(txAbsences.save).not.toHaveBeenCalled();
    });

    it('refuses a second absence at the same subject that day', async () => {
      txAbsences.exists.mockResolvedValue(true);

      await expect(service.createByTeacher(10, input)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(txAbsences.save).not.toHaveBeenCalled();
    });

    it("saves today's absence, not motivated, with a report", async () => {
      const view = await service.createByTeacher(10, input);

      expect(txAbsences.save).toHaveBeenCalledWith(
        expect.objectContaining({
          absentOn: getRomaniaDate(),
          motivated: false,
          teacherId: 7,
        }),
      );
      expect(view.studentName).toBe('Ana Pop');
      expect(view.motivated).toBe(false);
      expect(reportsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: ReportType.ABSENCE_CREATE }),
        manager,
      );
    });
  });

  describe('motivateByDirector', () => {
    const absence = () => ({
      id: 5,
      schoolId: 1,
      studentId: 1,
      teacherId: 7,
      absentOn: '2026-10-23',
      motivated: false,
      motivatedReason: null,
      motivatedAt: null,
    });

    it('does not find absences from another school', async () => {
      txAbsences.findOne.mockResolvedValue(null);

      await expect(
        service.motivateByDirector(1, 5, {}, 'dir@test.ro'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(txAbsences.findOne).toHaveBeenCalledWith({
        where: { id: 5, schoolId: 1 },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('does not motivate the same absence twice', async () => {
      txAbsences.findOne.mockResolvedValue({ ...absence(), motivated: true });

      await expect(
        service.motivateByDirector(1, 5, {}, 'dir@test.ro'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(txAbsences.save).not.toHaveBeenCalled();
    });

    it('marks the absence as motivated and keeps the reason', async () => {
      txAbsences.findOne.mockResolvedValue(absence());

      const result = await service.motivateByDirector(
        1,
        5,
        { reason: '  adeverinta medicala  ' },
        'dir@test.ro',
      );

      expect(result).toEqual({ id: 5, motivated: true });
      expect(txAbsences.save).toHaveBeenCalledWith(
        expect.objectContaining({
          motivated: true,
          motivatedReason: 'adeverinta medicala',
        }),
      );
      expect(reportsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: ReportType.ABSENCE_MOTIVATE }),
        manager,
      );
    });
  });
});
