import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, DataSource, Repository } from 'typeorm';
import { GradeType } from '../common/enums/grade-type.enum';
import { ReportType } from '../common/enums/report-type.enum';
import { Role } from '../common/enums/role.enum';
import {
  isValidDate,
  schoolYearStart,
  toDbDate,
  toDisplayDate,
} from '../common/utils/date.util';
import {
  likePattern,
  normalizeListQuery,
  resolveSort,
  toPaginated,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { fullName } from '../common/utils/full-name.util';
import { assertLessonDayFree } from '../common/utils/lesson-day.util';
import { getRomaniaDate } from '../common/utils/romania-time.util';
import { ReportsService } from '../reports/reports.service';
import { StudentsService, studentLabel } from '../students/students.service';
import { SubjectsService } from '../subjects/subjects.service';
import { TeachersService } from '../teachers/teachers.service';
import { TimetableService } from '../timetable/timetable.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { ListGradesQueryDto } from './dto/list-grades-query.dto';
import { Grade } from './entities/grade.entity';

export type GradeView = {
  id: number;
  studentId: number;
  subjectId: number;
  teacherId: number;
  value: number;
  type: GradeType;
  gradedOn: string;
  studentName: string;
  className: string;
  subjectName: string;
  createdAt: Date;
};

const GRADE_SORT = {
  gradedOn: 'grade.gradedOn',
  value: 'grade.value',
  createdAt: 'grade.createdAt',
  studentName: 'student.lastName',
  subjectName: 'subject.name',
};

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradesRepo: Repository<Grade>,
    private readonly subjectsService: SubjectsService,
    private readonly teachersService: TeachersService,
    private readonly studentsService: StudentsService,
    private readonly reportsService: ReportsService,
    private readonly timetableService: TimetableService,
    private readonly dataSource: DataSource,
  ) {}

  private toGradeView(grade: Grade): GradeView {
    return {
      id: grade.id,
      studentId: grade.studentId,
      subjectId: grade.subjectId,
      teacherId: grade.teacherId,
      value: Number(grade.value),
      type: grade.type ?? GradeType.NORMAL,
      gradedOn: toDisplayDate(grade.gradedOn),
      studentName: fullName(grade.student),
      className: grade.student?.schoolClass?.name ?? '',
      subjectName: grade.subject?.name ?? '',
      createdAt: grade.createdAt,
    };
  }

  // one thesis per subject in a school year (1 Sep - 31 Aug)
  private async assertNoThesisYet(
    studentId: number,
    subjectId: number,
    gradedOn: string,
  ) {
    const from = schoolYearStart(gradedOn);
    const to = `${Number(from.slice(0, 4)) + 1}-08-31`;
    const hasThesis = await this.gradesRepo.exists({
      where: {
        studentId,
        subjectId,
        type: GradeType.THESIS,
        gradedOn: Between(from, to),
      },
    });
    if (hasThesis) {
      throw new ConflictException(
        'Elevul are deja o teza la aceasta materie in anul scolar curent',
      );
    }
  }

  async createByTeacher(userId: number, dto: CreateGradeDto) {
    const teacher = await this.teachersService.getByUserIdOrFail(userId);
    const subject = await this.subjectsService.getByIdOrFail(dto.subjectId);
    const student = await this.studentsService.getByIdOrFail(dto.studentId);

    const canGrade = await this.subjectsService.canTeacherGradeStudent(
      teacher.id,
      dto.studentId,
      dto.subjectId,
    );
    if (!canGrade) {
      throw new BadRequestException(
        'Nu poti nota acest elev la materia selectata (verifica clasa si materiile predate)',
      );
    }
    if (subject.schoolId !== teacher.schoolId) {
      throw new BadRequestException('Materia nu apartine scolii');
    }

    if (!isValidDate(dto.gradedOn)) {
      throw new BadRequestException('Data notei nu este valida');
    }
    const gradedOn = toDbDate(dto.gradedOn);
    if (gradedOn > getRomaniaDate()) {
      throw new BadRequestException('Nu poti pune note cu o data din viitor');
    }

    // grades only during the lesson with the student's class (Romania time)
    await this.timetableService.assertTeacherInLessonNow(
      teacher.id,
      dto.subjectId,
      student.classId,
    );

    const type = dto.type ?? GradeType.NORMAL;
    if (type === GradeType.THESIS) {
      await this.assertNoThesisYet(dto.studentId, dto.subjectId, gradedOn);
    }

    const grade = await this.dataSource.transaction(async (manager) => {
      await assertLessonDayFree(manager, {
        studentId: dto.studentId,
        subjectId: dto.subjectId,
        date: gradedOn,
      });

      const repo = manager.getRepository(Grade);
      const saved = await repo.save(
        repo.create({
          studentId: dto.studentId,
          subjectId: dto.subjectId,
          teacherId: teacher.id,
          schoolId: subject.schoolId,
          value: dto.value,
          type,
          gradedOn,
        }),
      );

      const by = fullName(teacher);
      const kind = type === GradeType.THESIS ? 'Teza' : 'Nota';
      await this.reportsService.create(
        {
          schoolId: subject.schoolId,
          teacherId: teacher.id,
          type: ReportType.GRADE_CREATE,
          description: `${kind} ${dto.value} pentru ${studentLabel(student)} la ${subject.name} pe ${dto.gradedOn} (pusa de ${by})`,
          metadata: {
            gradeId: saved.id,
            studentId: student.id,
            subjectId: subject.id,
            value: dto.value,
            type,
            gradedOn: dto.gradedOn,
            actorName: by,
            actorRole: Role.TEACHER,
          },
        },
        manager,
      );

      return saved;
    });

    return this.toGradeView({ ...grade, student, subject });
  }

  private async pageGrades(
    filter: { teacherId?: number; studentId?: number },
    query: ListGradesQueryDto,
  ): Promise<PaginatedResult<GradeView>> {
    const { page, pageSize, search, sortBy, sortOrder, skip } =
      normalizeListQuery({ ...query, sortOrder: query.sortOrder || 'DESC' });

    const qb = this.gradesRepo
      .createQueryBuilder('grade')
      .innerJoin('grade.student', 'student')
      .innerJoin('student.schoolClass', 'class')
      .innerJoin('grade.subject', 'subject')
      .addSelect([
        'student.id',
        'student.firstName',
        'student.lastName',
        'class.id',
        'class.name',
        'subject.id',
        'subject.name',
      ]);

    if (filter.teacherId) {
      qb.andWhere('grade.teacherId = :teacherId', {
        teacherId: filter.teacherId,
      });
    }
    if (filter.studentId) {
      qb.andWhere('grade.studentId = :studentId', {
        studentId: filter.studentId,
      });
    }
    if (query.subjectId) {
      qb.andWhere('grade.subjectId = :subjectId', {
        subjectId: query.subjectId,
      });
    }
    if (query.studentId && !filter.studentId) {
      qb.andWhere('grade.studentId = :queryStudentId', {
        queryStudentId: query.studentId,
      });
    }
    if (search) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('student.firstName LIKE :q')
            .orWhere('student.lastName LIKE :q')
            .orWhere('class.name LIKE :q')
            .orWhere('subject.name LIKE :q');
        }),
      ).setParameter('q', likePattern(search));
    }

    const [items, total] = await qb
      .orderBy(resolveSort(sortBy, GRADE_SORT, 'gradedOn'), sortOrder)
      .addOrderBy('grade.id', sortOrder)
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return toPaginated(
      items.map((g) => this.toGradeView(g)),
      total,
      page,
      pageSize,
    );
  }

  async listForTeacher(userId: number, query: ListGradesQueryDto = {}) {
    const teacher = await this.teachersService.getByUserIdOrFail(userId);
    return this.pageGrades({ teacherId: teacher.id }, query);
  }

  async listForStudentUser(userId: number, query: ListGradesQueryDto = {}) {
    const student = await this.studentsService.getByUserIdOrFail(userId);
    return this.pageGrades({ studentId: student.id }, query);
  }

  async listForStudentInSchool(
    schoolId: number,
    studentId: number,
    query: ListGradesQueryDto = {},
  ) {
    const student = await this.studentsService.getByIdOrFail(studentId);
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('Elevul nu este in scoala ta');
    }
    return this.pageGrades({ studentId }, query);
  }
}
