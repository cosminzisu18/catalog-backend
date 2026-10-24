import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { ReportType } from '../common/enums/report-type.enum';
import { Role } from '../common/enums/role.enum';
import { toDisplayDate } from '../common/utils/date.util';
import { fullName } from '../common/utils/full-name.util';
import { assertLessonDayFree } from '../common/utils/lesson-day.util';
import {
  likePattern,
  normalizeListQuery,
  resolveSort,
  toPaginated,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { getRomaniaDate } from '../common/utils/romania-time.util';
import { ReportsService } from '../reports/reports.service';
import { StudentsService, studentLabel } from '../students/students.service';
import { SubjectsService } from '../subjects/subjects.service';
import { TeachersService } from '../teachers/teachers.service';
import { TimetableService } from '../timetable/timetable.service';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { ListAbsencesQueryDto } from './dto/list-absences-query.dto';
import { MotivateAbsenceDto } from './dto/motivate-absence.dto';
import { Absence } from './entities/absence.entity';

export type AbsenceView = {
  id: number;
  studentId: number;
  studentName: string;
  className: string;
  subjectId: number;
  subjectName: string;
  teacherName: string;
  absentOn: string;
  motivated: boolean;
  motivatedReason: string | null;
  motivatedAt: Date | null;
};

export type AbsenceSummary = {
  total: number;
  motivated: number;
  unmotivated: number;
};

export type AbsencePage = PaginatedResult<AbsenceView> & {
  summary: AbsenceSummary;
};

const SORT_COLUMNS = {
  absentOn: 'absence.absentOn',
  studentName: 'student.lastName',
  subjectName: 'subject.name',
};

@Injectable()
export class AbsencesService {
  constructor(
    @InjectRepository(Absence)
    private readonly absencesRepo: Repository<Absence>,
    private readonly teachersService: TeachersService,
    private readonly studentsService: StudentsService,
    private readonly subjectsService: SubjectsService,
    private readonly timetableService: TimetableService,
    private readonly reportsService: ReportsService,
    private readonly dataSource: DataSource,
  ) {}

  private toView(absence: Absence): AbsenceView {
    return {
      id: absence.id,
      studentId: absence.studentId,
      studentName: fullName(absence.student),
      className: absence.student?.schoolClass?.name ?? '',
      subjectId: absence.subjectId,
      subjectName: absence.subject?.name ?? '',
      teacherName: fullName(absence.teacher),
      absentOn: toDisplayDate(absence.absentOn),
      motivated: absence.motivated,
      motivatedReason: absence.motivatedReason,
      motivatedAt: absence.motivatedAt,
    };
  }

  // same rules as grades: the teacher teaches the subject, has it in the
  // timetable of the student's class and is in that lesson right now
  async createByTeacher(userId: number, dto: CreateAbsenceDto) {
    const teacher = await this.teachersService.getByUserIdOrFail(userId);
    const subject = await this.subjectsService.getByIdOrFail(dto.subjectId);
    const student = await this.studentsService.getByIdOrFail(dto.studentId);

    const canMark = await this.subjectsService.canTeacherGradeStudent(
      teacher.id,
      student.id,
      subject.id,
    );
    if (!canMark || subject.schoolId !== teacher.schoolId) {
      throw new BadRequestException(
        'Nu poti pune absenta acestui elev la materia selectata',
      );
    }
    await this.timetableService.assertTeacherInLessonNow(
      teacher.id,
      subject.id,
      student.classId,
    );

    const today = getRomaniaDate();
    const saved = await this.dataSource.transaction(async (manager) => {
      await assertLessonDayFree(manager, {
        studentId: student.id,
        subjectId: subject.id,
        date: today,
      });

      const repo = manager.getRepository(Absence);
      const absence = await repo.save(
        repo.create({
          schoolId: teacher.schoolId,
          studentId: student.id,
          subjectId: subject.id,
          teacherId: teacher.id,
          absentOn: today,
          motivated: false,
          motivatedReason: null,
          motivatedAt: null,
        }),
      );

      const by = fullName(teacher);
      await this.reportsService.create(
        {
          schoolId: teacher.schoolId,
          teacherId: teacher.id,
          type: ReportType.ABSENCE_CREATE,
          description: `Absenta pentru ${studentLabel(student)} la ${subject.name} pe ${toDisplayDate(today)} (pusa de ${by})`,
          metadata: {
            absenceId: absence.id,
            studentId: student.id,
            subjectId: subject.id,
            actorName: by,
            actorRole: Role.TEACHER,
          },
        },
        manager,
      );
      return absence;
    });

    return this.toView({ ...saved, student, subject, teacher });
  }

  async motivateByDirector(
    schoolId: number,
    id: number,
    dto: MotivateAbsenceDto,
    directorEmail: string,
  ) {
    const saved = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Absence);
      const absence = await repo.findOne({
        where: { id, schoolId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!absence) {
        throw new NotFoundException('Absenta nu a fost gasita');
      }
      if (absence.motivated) {
        throw new ConflictException('Absenta este deja motivata');
      }

      absence.motivated = true;
      absence.motivatedReason = dto.reason?.trim() || null;
      absence.motivatedAt = new Date();
      await repo.save(absence);

      const student = await this.studentsService.getByIdOrFail(
        absence.studentId,
        manager,
      );
      await this.reportsService.create(
        {
          schoolId,
          teacherId: absence.teacherId,
          type: ReportType.ABSENCE_MOTIVATE,
          description: `Absenta motivata pentru ${studentLabel(student)} din ${toDisplayDate(absence.absentOn)} (director: ${directorEmail})`,
          metadata: {
            absenceId: absence.id,
            studentId: absence.studentId,
            reason: absence.motivatedReason,
            actorName: directorEmail,
            actorRole: Role.DIRECTOR,
          },
        },
        manager,
      );
      return absence;
    });

    return { id: saved.id, motivated: saved.motivated };
  }

  private async page(
    filter: { schoolId?: number; teacherId?: number; studentId?: number },
    query: ListAbsencesQueryDto,
  ): Promise<AbsencePage> {
    const { page, pageSize, search, sortBy, sortOrder, skip } =
      normalizeListQuery({ ...query, sortOrder: query.sortOrder || 'DESC' });

    const qb = this.absencesRepo
      .createQueryBuilder('absence')
      .innerJoin('absence.student', 'student')
      .innerJoin('student.schoolClass', 'class')
      .innerJoin('absence.subject', 'subject')
      .innerJoin('absence.teacher', 'teacher')
      .addSelect([
        'student.id',
        'student.firstName',
        'student.lastName',
        'class.id',
        'class.name',
        'subject.id',
        'subject.name',
        'teacher.id',
        'teacher.firstName',
        'teacher.lastName',
      ]);

    if (filter.schoolId) {
      qb.andWhere('absence.schoolId = :schoolId', {
        schoolId: filter.schoolId,
      });
    }
    if (filter.teacherId) {
      qb.andWhere('absence.teacherId = :teacherId', {
        teacherId: filter.teacherId,
      });
    }
    const studentId = filter.studentId ?? query.studentId;
    if (studentId) {
      qb.andWhere('absence.studentId = :studentId', { studentId });
    }
    if (query.classId) {
      qb.andWhere('student.classId = :classId', { classId: query.classId });
    }
    if (search) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('student.firstName LIKE :q')
            .orWhere('student.lastName LIKE :q')
            .orWhere('subject.name LIKE :q');
        }),
      ).setParameter('q', likePattern(search));
    }

    // totals for the filters above, before the motivated filter and paging
    const totals = await qb
      .clone()
      .select('COUNT(*)', 'total')
      .addSelect('COALESCE(SUM(absence.motivated), 0)', 'motivated')
      .getRawOne<{ total: string; motivated: string }>();
    const total = Number(totals?.total ?? 0);
    const motivated = Number(totals?.motivated ?? 0);

    if (query.motivated !== undefined) {
      qb.andWhere('absence.motivated = :motivated', {
        motivated: query.motivated,
      });
    }

    const [items, count] = await qb
      .orderBy(resolveSort(sortBy, SORT_COLUMNS, 'absentOn'), sortOrder)
      .addOrderBy('absence.id', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return {
      ...toPaginated(
        items.map((a) => this.toView(a)),
        count,
        page,
        pageSize,
      ),
      summary: { total, motivated, unmotivated: total - motivated },
    };
  }

  listForSchool(schoolId: number, query: ListAbsencesQueryDto = {}) {
    return this.page({ schoolId }, query);
  }

  async listForTeacher(userId: number, query: ListAbsencesQueryDto = {}) {
    const teacher = await this.teachersService.getByUserIdOrFail(userId);
    return this.page({ teacherId: teacher.id }, query);
  }

  async listForStudentUser(userId: number, query: ListAbsencesQueryDto = {}) {
    const student = await this.studentsService.getByUserIdOrFail(userId);
    return this.page({ studentId: student.id }, query);
  }
}
