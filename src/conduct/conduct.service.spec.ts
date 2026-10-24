jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  TypeOrmModule: {
    forFeature: jest.fn(),
    forRoot: jest.fn(),
    forRootAsync: jest.fn(),
  },
}));

jest.mock('../teachers/teachers.service', () => ({
  TeachersService: class TeachersService {},
}));

jest.mock('../students/students.service', () => ({
  StudentsService: class StudentsService {},
  studentLabel: (s: {
    firstName: string;
    lastName: string;
    schoolClass?: { name: string };
  }) =>
    s.schoolClass
      ? `${s.firstName} ${s.lastName} (clasa ${s.schoolClass.name})`
      : `${s.firstName} ${s.lastName}`,
}));

jest.mock('../subjects/subjects.service', () => ({
  SubjectsService: class SubjectsService {},
}));

jest.mock('../reports/reports.service', () => ({
  ReportsService: class ReportsService {},
}));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConductStatus } from '../common/enums/conduct-status.enum';
import { Student } from '../students/entities/student.entity';
import { ConductService } from './conduct.service';

describe('ConductService', () => {
  const txStudents = { findOneOrFail: jest.fn() };
  const txRequests = {
    findOne: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(<T>(x: T) => x),
    save: jest.fn(<T>(x: T) => Promise.resolve(x)),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Student ? txStudents : txRequests,
    ),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    ),
  };

  const teachersService = { getByUserIdOrFail: jest.fn() };
  const studentsService = {
    getByIdOrFail: jest.fn(),
    setConductGrade: jest.fn(),
  };
  const subjectsService = { teacherTeachesStudent: jest.fn() };
  const reportsService = { create: jest.fn() };

  const service = new ConductService(
    {} as never,
    teachersService as never,
    studentsService as never,
    subjectsService as never,
    reportsService as never,
    dataSource as never,
  );

  const student = {
    id: 1,
    schoolId: 1,
    firstName: 'Ana',
    lastName: 'Pop',
    className: '9A',
    conductGrade: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    teachersService.getByUserIdOrFail.mockResolvedValue({
      id: 7,
      schoolId: 1,
      firstName: 'Ion',
      lastName: 'Pop',
    });
    studentsService.getByIdOrFail.mockResolvedValue(student);
    txStudents.findOneOrFail.mockResolvedValue(student);
    subjectsService.teacherTeachesStudent.mockResolvedValue(true);
    txRequests.exists.mockResolvedValue(false);
  });

  describe('createByTeacher', () => {
    const dto = { studentId: 1, proposedGrade: 8, teacherReason: 'absente' };

    it('only allows requests for students the teacher teaches', async () => {
      subjectsService.teacherTeachesStudent.mockResolvedValue(false);

      await expect(service.createByTeacher(10, dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a proposal that does not lower the grade', async () => {
      txStudents.findOneOrFail.mockResolvedValue({
        ...student,
        conductGrade: 8,
      });

      await expect(service.createByTeacher(10, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a duplicate pending request', async () => {
      txRequests.exists.mockResolvedValue(true);

      await expect(service.createByTeacher(10, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('decideByDirector', () => {
    const pending = {
      id: 3,
      schoolId: 1,
      studentId: 1,
      teacherId: 7,
      proposedGrade: 8,
      status: ConductStatus.PENDING,
    };

    it('lowers the conduct grade inside the transaction', async () => {
      txRequests.findOne.mockResolvedValue({ ...pending });

      const result = await service.decideByDirector(
        1,
        3,
        { approve: true, directorReason: 'motiv intemeiat' },
        'dir@test.ro',
      );

      expect(result.status).toBe(ConductStatus.APPROVED);
      expect(studentsService.setConductGrade).toHaveBeenCalledWith(
        1,
        8,
        manager,
      );
    });

    it('refuses to decide an already decided request', async () => {
      txRequests.findOne.mockResolvedValue({
        ...pending,
        status: ConductStatus.REJECTED,
      });

      await expect(
        service.decideByDirector(
          1,
          3,
          { approve: true, directorReason: 'motiv intemeiat' },
          'dir@test.ro',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(studentsService.setConductGrade).not.toHaveBeenCalled();
    });

    it('does not raise the grade back if it was lowered meanwhile', async () => {
      txRequests.findOne.mockResolvedValue({ ...pending });
      txStudents.findOneOrFail.mockResolvedValue({
        ...student,
        conductGrade: 7,
      });

      await expect(
        service.decideByDirector(
          1,
          3,
          { approve: true, directorReason: 'motiv intemeiat' },
          'dir@test.ro',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(studentsService.setConductGrade).not.toHaveBeenCalled();
    });
  });
});
