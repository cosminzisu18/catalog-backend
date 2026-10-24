import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassesService } from '../classes/classes.service';
import {
  DAY_LABELS_RO,
  getRomaniaClock,
  isTimeInRange,
} from '../common/utils/romania-time.util';
import { StudentsService } from '../students/students.service';
import { SubjectsService } from '../subjects/subjects.service';
import { TeachersService } from '../teachers/teachers.service';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { ListTimetableQueryDto } from './dto/list-timetable-query.dto';
import { UpdateTimetableSlotDto } from './dto/update-timetable-slot.dto';
import { TimetableSlot } from './entities/timetable-slot.entity';

export type TimetableSlotView = Omit<TimetableSlot, 'schoolClass'> & {
  className: string;
};

type SlotTiming = Pick<
  TimetableSlot,
  'classId' | 'teacherId' | 'dayOfWeek' | 'startTime' | 'endTime'
>;

@Injectable()
export class TimetableService {
  // lessons are Monday-Friday, like the calendar in the client.
  // TIMETABLE_WEEKEND=true also allows Saturday and Sunday: only the e2e
  // tests turn it on, so they can have a lesson "now" on a weekend
  private readonly lastDay: number;

  constructor(
    @InjectRepository(TimetableSlot)
    private readonly slotsRepo: Repository<TimetableSlot>,
    private readonly subjectsService: SubjectsService,
    private readonly teachersService: TeachersService,
    private readonly studentsService: StudentsService,
    private readonly classesService: ClassesService,
    config: ConfigService,
  ) {
    this.lastDay = config.get<string>('TIMETABLE_WEEKEND') === 'true' ? 7 : 5;
  }

  private toView(slot: TimetableSlot): TimetableSlotView {
    const { schoolClass, ...rest } = slot;
    return { ...rest, className: schoolClass?.name ?? '' };
  }

  private listQuery() {
    return this.slotsRepo
      .createQueryBuilder('slot')
      .innerJoin('slot.schoolClass', 'class')
      .addSelect(['class.id', 'class.name'])
      .orderBy('slot.dayOfWeek', 'ASC')
      .addOrderBy('slot.startTime', 'ASC');
  }

  private assertSchoolDay(day: number) {
    if (day > this.lastDay) {
      throw new BadRequestException('Orele se pun doar de luni pana vineri');
    }
  }

  private assertTimeOrder(start: string, end: string) {
    if (start >= end) {
      throw new BadRequestException(
        'Ora de sfarsit trebuie sa fie dupa ora de inceput',
      );
    }
  }

  // neither the class nor the teacher can have two overlapping lessons
  private async assertNoOverlap(slot: SlotTiming, excludeId?: number) {
    const qb = this.slotsRepo
      .createQueryBuilder('slot')
      .innerJoin('slot.schoolClass', 'class')
      .addSelect(['class.id', 'class.name'])
      .where('slot.dayOfWeek = :day', { day: slot.dayOfWeek })
      .andWhere('(slot.classId = :classId OR slot.teacherId = :teacherId)', {
        classId: slot.classId,
        teacherId: slot.teacherId,
      })
      .andWhere('slot.startTime < :end AND slot.endTime > :start', {
        start: slot.startTime,
        end: slot.endTime,
      });
    if (excludeId) {
      qb.andWhere('slot.id <> :excludeId', { excludeId });
    }

    const clash = await qb.getOne();
    if (!clash) return;

    const interval = `${clash.startTime}-${clash.endTime} (${DAY_LABELS_RO[slot.dayOfWeek]})`;
    throw new BadRequestException(
      clash.classId === slot.classId
        ? `Clasa are deja o ora in intervalul ${interval}`
        : `Profesorul preda deja la clasa ${clash.schoolClass?.name ?? ''} in intervalul ${interval}`,
    );
  }

  private async getInSchoolOrFail(schoolId: number, id: number) {
    const slot = await this.slotsRepo.findOne({ where: { id, schoolId } });
    if (!slot) {
      throw new NotFoundException('Slotul de orar nu a fost gasit');
    }
    return slot;
  }

  private async subjectInSchool(schoolId: number, subjectId: number) {
    const subject = await this.subjectsService.getByIdOrFail(subjectId);
    if (subject.schoolId !== schoolId) {
      throw new BadRequestException('Materia nu apartine scolii');
    }
    return subject;
  }

  private async getView(id: number): Promise<TimetableSlotView> {
    const slot = await this.listQuery()
      .where('slot.id = :id', { id })
      .getOneOrFail();
    return this.toView(slot);
  }

  async create(schoolId: number, dto: CreateTimetableSlotDto) {
    this.assertSchoolDay(dto.dayOfWeek);
    this.assertTimeOrder(dto.startTime, dto.endTime);
    const schoolClass = await this.classesService.getByIdOrFail(
      schoolId,
      dto.classId,
    );
    const subject = await this.subjectInSchool(schoolId, dto.subjectId);
    const teacherId = await this.subjectsService.resolveTeacherForSlot(
      schoolId,
      subject.id,
      dto.teacherId,
    );

    const slot = this.slotsRepo.create({
      schoolId,
      classId: schoolClass.id,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      subjectId: subject.id,
      teacherId,
      room: dto.room?.trim() || null,
    });
    await this.assertNoOverlap(slot);

    const saved = await this.slotsRepo.save(slot);
    return this.getView(saved.id);
  }

  async update(schoolId: number, id: number, dto: UpdateTimetableSlotDto) {
    const slot = await this.getInSchoolOrFail(schoolId, id);

    if (dto.classId !== undefined) {
      const schoolClass = await this.classesService.getByIdOrFail(
        schoolId,
        dto.classId,
      );
      slot.classId = schoolClass.id;
    }
    if (dto.subjectId !== undefined) {
      const subject = await this.subjectInSchool(schoolId, dto.subjectId);
      slot.subjectId = subject.id;
    }
    if (dto.subjectId !== undefined || dto.teacherId !== undefined) {
      slot.teacherId = await this.subjectsService.resolveTeacherForSlot(
        schoolId,
        slot.subjectId,
        dto.teacherId ?? slot.teacherId,
      );
    }
    if (dto.dayOfWeek !== undefined) slot.dayOfWeek = dto.dayOfWeek;
    if (dto.startTime !== undefined) slot.startTime = dto.startTime;
    if (dto.endTime !== undefined) slot.endTime = dto.endTime;
    if (dto.room !== undefined) slot.room = dto.room?.trim() || null;

    this.assertSchoolDay(slot.dayOfWeek);
    this.assertTimeOrder(slot.startTime, slot.endTime);
    await this.assertNoOverlap(slot, slot.id);

    await this.slotsRepo.save(slot);
    return this.getView(slot.id);
  }

  async remove(schoolId: number, id: number) {
    const slot = await this.getInSchoolOrFail(schoolId, id);
    await this.slotsRepo.remove(slot);
    return { ok: true };
  }

  async listForSchool(schoolId: number, query: ListTimetableQueryDto = {}) {
    const qb = this.listQuery().where('slot.schoolId = :schoolId', {
      schoolId,
    });
    if (query.classId) {
      qb.andWhere('slot.classId = :classId', { classId: query.classId });
    }
    if (query.teacherId) {
      qb.andWhere('slot.teacherId = :teacherId', {
        teacherId: query.teacherId,
      });
    }
    if (query.subjectId) {
      qb.andWhere('slot.subjectId = :subjectId', {
        subjectId: query.subjectId,
      });
    }
    const slots = await qb.getMany();
    return slots.map((s) => this.toView(s));
  }

  async listForTeacher(userId: number) {
    const teacher = await this.teachersService.getByUserIdOrFail(userId);
    const slots = await this.listQuery()
      .where('slot.teacherId = :teacherId', { teacherId: teacher.id })
      .getMany();
    return slots.map((s) => this.toView(s));
  }

  async listForStudent(userId: number) {
    const student = await this.studentsService.getByUserIdOrFail(userId);
    const slots = await this.listQuery()
      .where('slot.classId = :classId', { classId: student.classId })
      .getMany();
    return slots.map((s) => this.toView(s));
  }

  // with classId, the lesson must also be with that class
  async isTeacherInLessonNow(
    teacherId: number,
    subjectId: number,
    classId?: number,
  ): Promise<{
    inLesson: boolean;
    clock: ReturnType<typeof getRomaniaClock>;
    matchingSlot: TimetableSlot | null;
    message: string;
  }> {
    const clock = getRomaniaClock();
    const slots = await this.slotsRepo.find({
      where: {
        teacherId,
        subjectId,
        dayOfWeek: clock.dayOfWeek,
        ...(classId !== undefined && { classId }),
      },
    });

    const matching =
      slots.find((s) => isTimeInRange(clock.time, s.startTime, s.endTime)) ||
      null;

    if (matching) {
      return {
        inLesson: true,
        clock,
        matchingSlot: matching,
        message: `Esti la ora (${matching.startTime}-${matching.endTime}, ${DAY_LABELS_RO[clock.dayOfWeek]}).`,
      };
    }

    return {
      inLesson: false,
      clock,
      matchingSlot: null,
      message: `Nu esti la ora pentru aceasta materie${classId !== undefined ? ' cu clasa elevului' : ''} acum (${DAY_LABELS_RO[clock.dayOfWeek]} ${clock.time}). Notele si absentele se pun doar in timpul orei din orar.`,
    };
  }

  async lessonCheckForUser(userId: number, subjectId: number) {
    const teacher = await this.teachersService.getByUserIdOrFail(userId);
    return this.isTeacherInLessonNow(teacher.id, subjectId);
  }

  async assertTeacherInLessonNow(
    teacherId: number,
    subjectId: number,
    classId: number,
  ) {
    const check = await this.isTeacherInLessonNow(
      teacherId,
      subjectId,
      classId,
    );
    if (!check.inLesson) {
      throw new BadRequestException(check.message);
    }
    return check;
  }
}
