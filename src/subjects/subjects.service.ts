import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import {
  likePattern,
  normalizeListQuery,
  resolveSort,
  toPaginated,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { Grade } from '../grades/entities/grade.entity';
import { StudentsService } from '../students/students.service';
import { TeachersService } from '../teachers/teachers.service';
import { TimetableSlot } from '../timetable/entities/timetable-slot.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { ListSubjectsQueryDto } from './dto/list-subjects-query.dto';
import { Subject } from './entities/subject.entity';
import { TeacherSubject } from './entities/teacher-subject.entity';

export type SubjectView = Subject & { teacherCount: number };

export type EnrolledSubject = {
  id: number;
  name: string;
  gradeCount: number;
  average: string | null;
};

export type TeacherOption = {
  id: number;
  firstName: string;
  lastName: string;
};

const SORT_COLUMNS = {
  name: 'subject.name',
  createdAt: 'subject.createdAt',
};

const ENROLLED_SORT_COLUMNS = {
  name: 'subject.name',
  gradeCount: 'grade_count',
  average: 'average',
};

@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectsRepo: Repository<Subject>,
    @InjectRepository(TeacherSubject)
    private readonly teacherSubjectsRepo: Repository<TeacherSubject>,
    @InjectRepository(TimetableSlot)
    private readonly timetableRepo: Repository<TimetableSlot>,
    private readonly teachersService: TeachersService,
    private readonly studentsService: StudentsService,
  ) {}

  async create(schoolId: number, dto: CreateSubjectDto): Promise<Subject> {
    return this.subjectsRepo.save(
      this.subjectsRepo.create({
        schoolId,
        name: dto.name.trim(),
      }),
    );
  }

  listBySchool(schoolId: number, query: ListSubjectsQueryDto = {}) {
    return this.listPaged(schoolId, query);
  }

  private async listPaged(
    schoolId: number,
    query: ListSubjectsQueryDto,
  ): Promise<PaginatedResult<SubjectView>> {
    const { page, pageSize, search, sortBy, sortOrder, skip } =
      normalizeListQuery(query);

    const baseQb = this.subjectsRepo
      .createQueryBuilder('subject')
      .where('subject.schoolId = :schoolId', { schoolId });

    if (query.teacherId) {
      baseQb.innerJoin(
        TeacherSubject,
        'ts',
        'ts.subjectId = subject.id AND ts.teacherId = :teacherId',
        { teacherId: query.teacherId },
      );
    }
    if (search) {
      baseQb.andWhere('subject.name LIKE :q', { q: likePattern(search) });
    }

    const total = await baseQb.getCount();
    const items = await baseQb
      .orderBy(resolveSort(sortBy, SORT_COLUMNS, 'name'), sortOrder)
      .addOrderBy('subject.id', 'ASC')
      .skip(skip)
      .take(pageSize)
      .getMany();

    const counts = items.length
      ? await this.teacherSubjectsRepo
          .createQueryBuilder('ts')
          .select('ts.subjectId', 'subjectId')
          .addSelect('COUNT(*)', 'cnt')
          .where('ts.subjectId IN (:...ids)', {
            ids: items.map((s) => s.id),
          })
          .groupBy('ts.subjectId')
          .getRawMany<{ subjectId: number; cnt: string }>()
      : [];

    const countMap = new Map(
      counts.map((c) => [Number(c.subjectId), Number(c.cnt)]),
    );

    return toPaginated(
      items.map((s) => ({ ...s, teacherCount: countMap.get(s.id) ?? 0 })),
      total,
      page,
      pageSize,
    );
  }

  async listForTeacherUser(userId: number, query: ListSubjectsQueryDto = {}) {
    const teacher = await this.teachersService.getByUserIdOrFail(userId);
    return this.listPaged(teacher.schoolId, {
      ...query,
      teacherId: teacher.id,
    });
  }

  async lookup(
    user: AuthUser,
    schoolId: number,
  ): Promise<Pick<Subject, 'id' | 'name'>[]> {
    const qb = this.subjectsRepo
      .createQueryBuilder('subject')
      .select(['subject.id', 'subject.name'])
      .where('subject.schoolId = :schoolId', { schoolId })
      .orderBy('subject.name', 'ASC');

    if (user.role === Role.TEACHER) {
      const teacher = await this.teachersService.getByUserIdOrFail(user.id);
      qb.innerJoin(
        TeacherSubject,
        'ts',
        'ts.subjectId = subject.id AND ts.teacherId = :teacherId',
        { teacherId: teacher.id },
      );
    } else if (user.role === Role.STUDENT) {
      const student = await this.studentsService.getByUserIdOrFail(user.id);
      qb.innerJoin(
        TimetableSlot,
        'slot',
        'slot.classId = :classId AND slot.subjectId = subject.id',
        { classId: student.classId },
      );
    }

    return qb.distinct(true).getMany();
  }

  async getByIdOrFail(id: number): Promise<Subject> {
    const subject = await this.subjectsRepo.findOne({ where: { id } });
    if (!subject) {
      throw new NotFoundException('Materia nu a fost gasita');
    }
    return subject;
  }

  async teachersForSubject(
    schoolId: number,
    subjectId: number,
  ): Promise<TeacherOption[]> {
    const subject = await this.getByIdOrFail(subjectId);
    if (subject.schoolId !== schoolId) {
      throw new BadRequestException('Materia nu apartine scolii');
    }

    const rows = await this.teacherSubjectsRepo
      .createQueryBuilder('ts')
      .innerJoinAndSelect('ts.teacher', 'teacher')
      .where('ts.subjectId = :subjectId', { subjectId })
      .andWhere('ts.schoolId = :schoolId', { schoolId })
      .orderBy('teacher.lastName', 'ASC')
      .addOrderBy('teacher.firstName', 'ASC')
      .getMany();

    return rows.map((ts) => ({
      id: ts.teacher!.id,
      firstName: ts.teacher!.firstName,
      lastName: ts.teacher!.lastName,
    }));
  }

  async resolveTeacherForSlot(
    schoolId: number,
    subjectId: number,
    teacherId?: number,
  ): Promise<number> {
    const options = await this.teachersForSubject(schoolId, subjectId);
    if (options.length === 0) {
      throw new BadRequestException(
        'Niciun profesor nu preda materia selectata. Leaga profesorii de materie din pagina Profesori.',
      );
    }
    if (teacherId != null) {
      if (!options.some((t) => t.id === teacherId)) {
        throw new BadRequestException(
          'Profesorul selectat nu preda aceasta materie',
        );
      }
      return teacherId;
    }
    if (options.length > 1) {
      throw new BadRequestException(
        'Exista mai multi profesori pe aceasta materie. Selecteaza profesorul pentru ora.',
      );
    }
    return options[0].id;
  }

  async setTeacherSubjects(
    schoolId: number,
    teacherId: number,
    subjectIds: number[],
  ): Promise<{ subjectIds: number[] }> {
    const teacher = await this.teachersService.getByIdOrFail(teacherId);
    if (teacher.schoolId !== schoolId) {
      throw new BadRequestException('Profesorul nu apartine scolii');
    }

    const unique = [...new Set(subjectIds)];
    if (unique.length) {
      const found = await this.subjectsRepo.count({
        where: { schoolId, id: In(unique) },
      });
      if (found !== unique.length) {
        throw new BadRequestException('Unele materii nu apartin scolii');
      }
    }

    // in a transaction so a failed insert does not wipe the list
    await this.teacherSubjectsRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(TeacherSubject);
      await repo.delete({ teacherId });
      if (unique.length) {
        await repo.save(
          unique.map((subjectId) =>
            repo.create({ schoolId, teacherId, subjectId }),
          ),
        );
      }
    });
    return { subjectIds: unique };
  }

  async listSubjectIdsForTeacher(teacherId: number): Promise<number[]> {
    const rows = await this.teacherSubjectsRepo.find({
      where: { teacherId },
      select: ['subjectId'],
    });
    return rows.map((r) => r.subjectId);
  }

  async listSubjectsForStudent(
    schoolId: number,
    studentId: number,
  ): Promise<Subject[]> {
    const student = await this.studentsService.getByIdOrFail(studentId);
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('Elevul nu este in scoala ta');
    }
    return this.subjectsRepo
      .createQueryBuilder('subject')
      .innerJoin(
        TimetableSlot,
        'slot',
        'slot.classId = :classId AND slot.subjectId = subject.id',
        { classId: student.classId },
      )
      .where('subject.schoolId = :schoolId', { schoolId: student.schoolId })
      .orderBy('subject.name', 'ASC')
      .distinct(true)
      .getMany();
  }

  async listEnrolledForStudent(
    studentId: number,
    query: ListSubjectsQueryDto = {},
  ): Promise<PaginatedResult<EnrolledSubject>> {
    const student = await this.studentsService.getByIdOrFail(studentId);
    const { page, pageSize, search, sortBy, sortOrder, skip } =
      normalizeListQuery(query);

    const base = this.subjectsRepo
      .createQueryBuilder('subject')
      .innerJoin(
        TimetableSlot,
        'slot',
        'slot.classId = :classId AND slot.subjectId = subject.id',
        { classId: student.classId },
      )
      .where('subject.schoolId = :schoolId', { schoolId: student.schoolId });

    if (search) {
      base.andWhere('subject.name LIKE :q', { q: likePattern(search) });
    }

    const total = await base.clone().distinct(true).getCount();

    const rows = await base
      .clone()
      .leftJoin(
        Grade,
        'grade',
        'grade.subjectId = subject.id AND grade.studentId = :studentId',
        { studentId },
      )
      .select('subject.id', 'id')
      .addSelect('subject.name', 'name')
      .addSelect('COUNT(DISTINCT grade.id)', 'grade_count')
      .addSelect('AVG(grade.value)', 'average')
      .groupBy('subject.id')
      .addGroupBy('subject.name')
      .orderBy(resolveSort(sortBy, ENROLLED_SORT_COLUMNS, 'name'), sortOrder)
      .addOrderBy('subject.id', 'ASC')
      .offset(skip)
      .limit(pageSize)
      .getRawMany<{
        id: number;
        name: string;
        grade_count: string;
        average: string | null;
      }>();

    const items = rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      gradeCount: Number(r.grade_count),
      average: r.average != null ? Number(r.average).toFixed(2) : null,
    }));

    return toPaginated(items, total, page, pageSize);
  }

  async listEnrolledForStudentUser(
    userId: number,
    query: ListSubjectsQueryDto = {},
  ) {
    const student = await this.studentsService.getByUserIdOrFail(userId);
    return this.listEnrolledForStudent(student.id, query);
  }

  // a teacher can grade a student if they teach the subject and have
  // it in the timetable of the student's class
  async canTeacherGradeStudent(
    teacherId: number,
    studentId: number,
    subjectId: number,
  ): Promise<boolean> {
    const student = await this.studentsService.getByIdOrFail(studentId);
    const teaches = await this.teacherSubjectsRepo.exists({
      where: { teacherId, subjectId },
    });
    if (!teaches) return false;
    return this.timetableRepo.exists({
      where: {
        teacherId,
        subjectId,
        classId: student.classId,
      },
    });
  }

  async teacherTeachesStudent(
    teacherId: number,
    studentId: number,
  ): Promise<boolean> {
    const student = await this.studentsService.getByIdOrFail(studentId);
    return this.timetableRepo.exists({
      where: { classId: student.classId, teacherId },
    });
  }

  async removeForSchool(
    schoolId: number,
    subjectId: number,
  ): Promise<{ deleted: true }> {
    const subject = await this.getByIdOrFail(subjectId);
    if (subject.schoolId !== schoolId) {
      throw new ForbiddenException('Materia nu apartine scolii tale');
    }
    await this.subjectsRepo.delete({ id: subjectId });
    return { deleted: true };
  }
}
