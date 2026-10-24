jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('../subjects/subjects.service', () => ({
  SubjectsService: class SubjectsService {},
}));

jest.mock('../teachers/teachers.service', () => ({
  TeachersService: class TeachersService {},
}));

jest.mock('../students/students.service', () => ({
  StudentsService: class StudentsService {},
}));

jest.mock('../classes/classes.service', () => ({
  ClassesService: class ClassesService {},
}));

import { BadRequestException } from '@nestjs/common';
import { TimetableService } from './timetable.service';

// small fake of the TypeORM query builder: every call returns the builder
function fakeQueryBuilder() {
  const qb = {
    getOne: jest.fn(),
    getOneOrFail: jest.fn(),
    getMany: jest.fn(),
  } as Record<string, jest.Mock>;
  for (const name of [
    'innerJoin',
    'addSelect',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
  ]) {
    qb[name] = jest.fn(() => qb);
  }
  return qb;
}

describe('TimetableService', () => {
  let qb: ReturnType<typeof fakeQueryBuilder>;

  const slotsRepo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn(<T>(x: T) => x),
    save: jest.fn(),
    find: jest.fn(),
  };
  const subjectsService = {
    getByIdOrFail: jest.fn(),
    resolveTeacherForSlot: jest.fn(),
  };
  const classesService = {
    getByIdOrFail: jest.fn(),
  };

  const service = new TimetableService(
    slotsRepo as never,
    subjectsService as never,
    {} as never,
    {} as never,
    classesService as never,
    { get: () => undefined } as never,
  );

  const slotInput = {
    classId: 4,
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '08:50',
    subjectId: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    qb = fakeQueryBuilder();
    classesService.getByIdOrFail.mockResolvedValue({ id: 4, name: '9A' });
    subjectsService.getByIdOrFail.mockResolvedValue({ id: 3, schoolId: 1 });
    subjectsService.resolveTeacherForSlot.mockResolvedValue(7);
  });

  describe('create', () => {
    it('rejects a lesson that ends before it starts', async () => {
      await expect(
        service.create(1, { ...slotInput, startTime: '09:00' }),
      ).rejects.toThrow('Ora de sfarsit trebuie sa fie dupa ora de inceput');
      expect(slotsRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a lesson on Saturday or Sunday', async () => {
      await expect(
        service.create(1, { ...slotInput, dayOfWeek: 6 }),
      ).rejects.toThrow('Orele se pun doar de luni pana vineri');
      expect(slotsRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a subject from another school', async () => {
      subjectsService.getByIdOrFail.mockResolvedValue({ id: 3, schoolId: 2 });

      await expect(service.create(1, slotInput)).rejects.toThrow(
        'Materia nu apartine scolii',
      );
    });

    it('rejects a lesson that overlaps another lesson of the class', async () => {
      qb.getOne.mockResolvedValue({
        classId: 4,
        teacherId: 9,
        startTime: '08:30',
        endTime: '09:20',
      });

      await expect(service.create(1, slotInput)).rejects.toThrow(
        'Clasa are deja o ora in intervalul 08:30-09:20 (Luni)',
      );
      expect(slotsRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a lesson when the teacher is busy with another class', async () => {
      qb.getOne.mockResolvedValue({
        classId: 5,
        teacherId: 7,
        startTime: '08:00',
        endTime: '08:50',
        schoolClass: { name: '10B' },
      });

      await expect(service.create(1, slotInput)).rejects.toThrow(
        'Profesorul preda deja la clasa 10B',
      );
    });

    it('saves the lesson with the resolved teacher', async () => {
      qb.getOne.mockResolvedValue(null);
      slotsRepo.save.mockResolvedValue({ id: 12 });
      qb.getOneOrFail.mockResolvedValue({
        id: 12,
        ...slotInput,
        teacherId: 7,
        schoolClass: { id: 4, name: '9A' },
      });

      const view = await service.create(1, { ...slotInput, room: '  12 ' });

      expect(slotsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: 1, teacherId: 7, room: '12' }),
      );
      expect(view.className).toBe('9A');
      expect(view).not.toHaveProperty('schoolClass');
    });
  });

  describe('isTeacherInLessonNow', () => {
    beforeEach(() => {
      // Wednesday 21 Oct 2026, 10:30 in Bucharest (UTC+3)
      jest.useFakeTimers({ now: new Date('2026-10-21T07:30:00Z') });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('finds the lesson that is happening now', async () => {
      slotsRepo.find.mockResolvedValue([
        { startTime: '08:00', endTime: '08:50' },
        { startTime: '10:00', endTime: '10:50' },
      ]);

      const check = await service.isTeacherInLessonNow(7, 3);

      expect(check.inLesson).toBe(true);
      expect(check.matchingSlot?.startTime).toBe('10:00');
      expect(slotsRepo.find).toHaveBeenCalledWith({
        where: { teacherId: 7, subjectId: 3, dayOfWeek: 3 },
      });
    });

    it('filters by class when a class is given', async () => {
      slotsRepo.find.mockResolvedValue([]);

      const check = await service.isTeacherInLessonNow(7, 3, 4);

      expect(check.inLesson).toBe(false);
      expect(slotsRepo.find).toHaveBeenCalledWith({
        where: { teacherId: 7, subjectId: 3, dayOfWeek: 3, classId: 4 },
      });
    });

    it('does not allow grading outside the lesson', async () => {
      slotsRepo.find.mockResolvedValue([
        { startTime: '12:00', endTime: '12:50' },
      ]);

      await expect(
        service.assertTeacherInLessonNow(7, 3, 4),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
