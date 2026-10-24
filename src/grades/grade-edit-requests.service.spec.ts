jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
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

import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConductStatus } from '../common/enums/conduct-status.enum';
import { GradeEditRequest } from './entities/grade-edit-request.entity';
import { Grade } from './entities/grade.entity';
import { GradeEditRequestsService } from './grade-edit-requests.service';

describe('GradeEditRequestsService', () => {
  const txGrades = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const txRequests = {
    create: jest.fn(<T>(x: T) => x),
    save: jest.fn(<T>(x: T) => Promise.resolve(x)),
    findOne: jest.fn(),
    exists: jest.fn(),
  };

  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Grade ? txGrades : txRequests,
    ),
  };

  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    ),
  };

  const subjectsService = { getByIdOrFail: jest.fn() };
  const teachersService = { getByUserIdOrFail: jest.fn() };
  const studentsService = { getByIdOrFail: jest.fn() };
  const reportsService = { create: jest.fn() };

  const service = new GradeEditRequestsService(
    {} as never,
    subjectsService as never,
    teachersService as never,
    studentsService as never,
    reportsService as never,
    dataSource as never,
  );

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
      firstName: 'Ana',
      lastName: 'Pop',
      schoolId: 1,
    });
  });

  describe('requestEditByTeacher', () => {
    const grade = {
      id: 5,
      teacherId: 7,
      schoolId: 1,
      studentId: 1,
      subjectId: 3,
      value: 6,
    };

    it('locks the grade row while checking for pending requests', async () => {
      txGrades.findOne.mockResolvedValue(grade);
      txRequests.exists.mockResolvedValue(false);

      await service.requestEditByTeacher(10, 5, {
        proposedValue: 8,
        teacherReason: 'gresit de tastare',
      });

      expect(txGrades.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
    });

    it('rejects edits for grades of another teacher', async () => {
      txGrades.findOne.mockResolvedValue({ ...grade, teacherId: 99 });

      await expect(
        service.requestEditByTeacher(10, 5, {
          proposedValue: 8,
          teacherReason: 'gresit de tastare',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a second pending request for the same grade', async () => {
      txGrades.findOne.mockResolvedValue(grade);
      txRequests.exists.mockResolvedValue(true);

      await expect(
        service.requestEditByTeacher(10, 5, {
          proposedValue: 8,
          teacherReason: 'gresit de tastare',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('decideEditByDirector', () => {
    const pendingRequest = (): Partial<GradeEditRequest> => ({
      id: 4,
      schoolId: 1,
      gradeId: 5,
      studentId: 1,
      subjectId: 3,
      teacherId: 7,
      currentValue: 6,
      proposedValue: 8,
      status: ConductStatus.PENDING,
    });

    it('applies the new value when approved', async () => {
      txRequests.findOne.mockResolvedValue(pendingRequest());

      const result = await service.decideEditByDirector(
        1,
        4,
        { approve: true, directorReason: 'corectie justificata' },
        'dir@test.ro',
      );

      expect(result.status).toBe(ConductStatus.APPROVED);
      expect(txGrades.update).toHaveBeenCalledWith({ id: 5 }, { value: 8 });
      expect(reportsService.create).toHaveBeenCalledTimes(2);
    });

    it('does not decide the same request twice', async () => {
      txRequests.findOne.mockResolvedValue({
        ...pendingRequest(),
        status: ConductStatus.APPROVED,
      });

      await expect(
        service.decideEditByDirector(
          1,
          4,
          { approve: true, directorReason: 'corectie justificata' },
          'dir@test.ro',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(txGrades.update).not.toHaveBeenCalled();
    });
  });
});
