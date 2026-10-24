jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('../teachers/teachers.service', () => ({
  TeachersService: class TeachersService {},
}));

jest.mock('../students/students.service', () => ({
  StudentsService: class StudentsService {},
}));

import { BadRequestException } from '@nestjs/common';
import { SubjectsService } from './subjects.service';

describe('SubjectsService', () => {
  // teachers linked to the subject, returned by the query builder below
  let linkedTeachers: {
    teacher: { id: number; firstName: string; lastName: string };
  }[];

  const teacherQb: Record<string, jest.Mock> = {
    getMany: jest.fn(() => Promise.resolve(linkedTeachers)),
  };
  for (const name of [
    'innerJoinAndSelect',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
  ]) {
    teacherQb[name] = jest.fn(() => teacherQb);
  }

  const txRepo = {
    delete: jest.fn(),
    save: jest.fn(),
    create: jest.fn(<T>(x: T) => x),
  };

  const subjectsRepo = {
    findOne: jest.fn(),
    count: jest.fn(),
  };
  const teacherSubjectsRepo = {
    createQueryBuilder: jest.fn(() => teacherQb),
    exists: jest.fn(),
    manager: {
      transaction: jest.fn(
        (cb: (m: { getRepository: () => typeof txRepo }) => Promise<void>) =>
          cb({ getRepository: () => txRepo }),
      ),
    },
  };
  const timetableRepo = {
    exists: jest.fn(),
  };
  const teachersService = {
    getByIdOrFail: jest.fn(),
  };
  const studentsService = {
    getByIdOrFail: jest.fn(),
  };

  const service = new SubjectsService(
    subjectsRepo as never,
    teacherSubjectsRepo as never,
    timetableRepo as never,
    teachersService as never,
    studentsService as never,
  );

  const ana = { id: 7, firstName: 'Ana', lastName: 'Pop' };
  const ion = { id: 8, firstName: 'Ion', lastName: 'Ionescu' };

  beforeEach(() => {
    jest.clearAllMocks();
    linkedTeachers = [];
    subjectsRepo.findOne.mockResolvedValue({ id: 3, schoolId: 1 });
  });

  describe('resolveTeacherForSlot', () => {
    it('fails when nobody teaches the subject', async () => {
      await expect(service.resolveTeacherForSlot(1, 3)).rejects.toThrow(
        'Niciun profesor nu preda materia selectata',
      );
    });

    it('picks the only teacher automatically', async () => {
      linkedTeachers = [{ teacher: ana }];
      await expect(service.resolveTeacherForSlot(1, 3)).resolves.toBe(7);
    });

    it('asks for a teacher when there are several', async () => {
      linkedTeachers = [{ teacher: ana }, { teacher: ion }];
      await expect(service.resolveTeacherForSlot(1, 3)).rejects.toThrow(
        'Selecteaza profesorul pentru ora',
      );
      await expect(service.resolveTeacherForSlot(1, 3, 8)).resolves.toBe(8);
    });

    it('rejects a teacher who does not teach the subject', async () => {
      linkedTeachers = [{ teacher: ana }];
      await expect(
        service.resolveTeacherForSlot(1, 3, 99),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a subject from another school', async () => {
      subjectsRepo.findOne.mockResolvedValue({ id: 3, schoolId: 2 });
      await expect(service.resolveTeacherForSlot(1, 3)).rejects.toThrow(
        'Materia nu apartine scolii',
      );
    });
  });

  describe('setTeacherSubjects', () => {
    beforeEach(() => {
      teachersService.getByIdOrFail.mockResolvedValue({ id: 7, schoolId: 1 });
    });

    it('rejects a teacher from another school', async () => {
      teachersService.getByIdOrFail.mockResolvedValue({ id: 7, schoolId: 2 });

      await expect(service.setTeacherSubjects(1, 7, [3])).rejects.toThrow(
        'Profesorul nu apartine scolii',
      );
      expect(txRepo.delete).not.toHaveBeenCalled();
    });

    it('rejects subjects that are not in the school', async () => {
      subjectsRepo.count.mockResolvedValue(1);

      await expect(service.setTeacherSubjects(1, 7, [3, 5])).rejects.toThrow(
        'Unele materii nu apartin scolii',
      );
      expect(txRepo.delete).not.toHaveBeenCalled();
    });

    it('replaces the list inside one transaction, without duplicates', async () => {
      subjectsRepo.count.mockResolvedValue(2);

      const result = await service.setTeacherSubjects(1, 7, [3, 5, 3]);

      expect(result).toEqual({ subjectIds: [3, 5] });
      expect(teacherSubjectsRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(txRepo.delete).toHaveBeenCalledWith({ teacherId: 7 });
      expect(txRepo.save).toHaveBeenCalledWith([
        { schoolId: 1, teacherId: 7, subjectId: 3 },
        { schoolId: 1, teacherId: 7, subjectId: 5 },
      ]);
    });

    it('can remove all subjects', async () => {
      await service.setTeacherSubjects(1, 7, []);

      expect(txRepo.delete).toHaveBeenCalledWith({ teacherId: 7 });
      expect(txRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('canTeacherGradeStudent', () => {
    beforeEach(() => {
      studentsService.getByIdOrFail.mockResolvedValue({ id: 1, classId: 4 });
    });

    it('is false when the teacher does not teach the subject', async () => {
      teacherSubjectsRepo.exists.mockResolvedValue(false);

      await expect(service.canTeacherGradeStudent(7, 1, 3)).resolves.toBe(
        false,
      );
      expect(timetableRepo.exists).not.toHaveBeenCalled();
    });

    it("needs a lesson in the timetable of the student's class", async () => {
      teacherSubjectsRepo.exists.mockResolvedValue(true);
      timetableRepo.exists.mockResolvedValue(true);

      await expect(service.canTeacherGradeStudent(7, 1, 3)).resolves.toBe(true);
      expect(timetableRepo.exists).toHaveBeenCalledWith({
        where: { teacherId: 7, subjectId: 3, classId: 4 },
      });
    });
  });
});
