import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { ConductStatus } from '../common/enums/conduct-status.enum';
import { ReportType } from '../common/enums/report-type.enum';
import { Role } from '../common/enums/role.enum';
import { fullName } from '../common/utils/full-name.util';
import {
  likePattern,
  normalizeListQuery,
  resolveSort,
  toPaginated,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { ReportsService } from '../reports/reports.service';
import { StudentsService, studentLabel } from '../students/students.service';
import { SubjectsService } from '../subjects/subjects.service';
import { TeachersService } from '../teachers/teachers.service';
import { CreateGradeEditRequestDto } from './dto/create-grade-edit-request.dto';
import { DecideGradeEditRequestDto } from './dto/decide-grade-edit-request.dto';
import { ListGradesQueryDto } from './dto/list-grades-query.dto';
import { GradeEditRequest } from './entities/grade-edit-request.entity';
import { Grade } from './entities/grade.entity';

export type GradeEditRequestView = Omit<
  GradeEditRequest,
  'student' | 'subject' | 'teacher' | 'grade' | 'school'
> & {
  studentName: string;
  className: string;
  subjectName: string;
  teacherName: string;
};

const EDIT_REQUEST_SORT = {
  createdAt: 'request.createdAt',
  proposedValue: 'request.proposedValue',
  status: 'request.status',
  studentName: 'student.lastName',
};

// a saved grade can only change through a request approved by the director
@Injectable()
export class GradeEditRequestsService {
  constructor(
    @InjectRepository(GradeEditRequest)
    private readonly editRequestsRepo: Repository<GradeEditRequest>,
    private readonly subjectsService: SubjectsService,
    private readonly teachersService: TeachersService,
    private readonly studentsService: StudentsService,
    private readonly reportsService: ReportsService,
    private readonly dataSource: DataSource,
  ) {}

  private toRequestView(request: GradeEditRequest): GradeEditRequestView {
    const { student, subject, teacher, ...rest } = request;
    return {
      ...rest,
      currentValue: Number(request.currentValue),
      proposedValue: Number(request.proposedValue),
      studentName: fullName(student),
      className: student?.schoolClass?.name ?? '',
      subjectName: subject?.name ?? '',
      teacherName: fullName(teacher),
    };
  }

  async requestEditByTeacher(
    userId: number,
    gradeId: number,
    dto: CreateGradeEditRequestDto,
  ) {
    const teacher = await this.teachersService.getByUserIdOrFail(userId);

    const request = await this.dataSource.transaction(async (manager) => {
      // lock the grade: two requests for the same grade run one after the
      // other, and the second one sees the pending request of the first
      const grade = await manager.getRepository(Grade).findOne({
        where: { id: gradeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!grade) {
        throw new NotFoundException('Nota nu a fost gasita');
      }
      if (grade.teacherId !== teacher.id) {
        throw new ForbiddenException(
          'Poti cere editarea doar pentru notele puse de tine',
        );
      }
      if (Number(dto.proposedValue) === Number(grade.value)) {
        throw new BadRequestException(
          'Nota propusa trebuie sa fie diferita de cea actuala',
        );
      }

      const repo = manager.getRepository(GradeEditRequest);
      const pending = await repo.exists({
        where: { gradeId: grade.id, status: ConductStatus.PENDING },
      });
      if (pending) {
        throw new ConflictException(
          'Exista deja o cerere de editare in asteptare pentru aceasta nota',
        );
      }

      const saved = await repo.save(
        repo.create({
          schoolId: grade.schoolId,
          gradeId: grade.id,
          studentId: grade.studentId,
          subjectId: grade.subjectId,
          teacherId: teacher.id,
          currentValue: Number(grade.value),
          proposedValue: dto.proposedValue,
          teacherReason: dto.teacherReason,
          status: ConductStatus.PENDING,
        }),
      );

      const student = await this.studentsService.getByIdOrFail(grade.studentId);
      const subject = await this.subjectsService.getByIdOrFail(grade.subjectId);
      const by = fullName(teacher);
      await this.reportsService.create(
        {
          schoolId: grade.schoolId,
          teacherId: teacher.id,
          type: ReportType.GRADE_EDIT_REQUEST,
          description: `Cerere editare nota pentru ${studentLabel(student)} la ${subject.name}: ${Number(grade.value)} → ${dto.proposedValue} (de ${by})`,
          metadata: {
            requestId: saved.id,
            gradeId: grade.id,
            studentId: student.id,
            subjectId: subject.id,
            currentValue: Number(grade.value),
            proposedValue: dto.proposedValue,
            teacherReason: dto.teacherReason,
            actorName: by,
            actorRole: Role.TEACHER,
          },
        },
        manager,
      );

      return saved;
    });

    return {
      ...request,
      currentValue: Number(request.currentValue),
      proposedValue: Number(request.proposedValue),
    };
  }

  private requestsQuery() {
    return this.editRequestsRepo
      .createQueryBuilder('request')
      .innerJoin('request.student', 'student')
      .innerJoin('student.schoolClass', 'class')
      .innerJoin('request.subject', 'subject')
      .innerJoin('request.teacher', 'teacher')
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
  }

  private async pageRequests(
    qb: ReturnType<GradeEditRequestsService['requestsQuery']>,
    query: ListGradesQueryDto,
    defaultOrder: 'ASC' | 'DESC',
  ): Promise<PaginatedResult<GradeEditRequestView>> {
    const { page, pageSize, search, sortBy, sortOrder, skip } =
      normalizeListQuery({
        ...query,
        sortOrder: query.sortOrder || defaultOrder,
      });

    if (search) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('student.firstName LIKE :q')
            .orWhere('student.lastName LIKE :q')
            .orWhere('subject.name LIKE :q')
            .orWhere('teacher.lastName LIKE :q')
            .orWhere('request.teacherReason LIKE :q');
        }),
      ).setParameter('q', likePattern(search));
    }

    const [items, total] = await qb
      .orderBy(resolveSort(sortBy, EDIT_REQUEST_SORT, 'createdAt'), sortOrder)
      .addOrderBy('request.id', 'ASC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return toPaginated(
      items.map((r) => this.toRequestView(r)),
      total,
      page,
      pageSize,
    );
  }

  listPendingEditRequests(schoolId: number, query: ListGradesQueryDto = {}) {
    const qb = this.requestsQuery()
      .where('request.schoolId = :schoolId', { schoolId })
      .andWhere('request.status = :status', { status: ConductStatus.PENDING });
    return this.pageRequests(qb, query, 'ASC');
  }

  async listEditRequestsForTeacher(
    userId: number,
    query: ListGradesQueryDto = {},
  ) {
    const teacher = await this.teachersService.getByUserIdOrFail(userId);
    const qb = this.requestsQuery().where('request.teacherId = :teacherId', {
      teacherId: teacher.id,
    });
    return this.pageRequests(qb, query, 'DESC');
  }

  async decideEditByDirector(
    schoolId: number,
    requestId: number,
    dto: DecideGradeEditRequestDto,
    directorEmail: string,
  ) {
    const saved = await this.dataSource.transaction(async (manager) => {
      // lock the request so two decisions at once can't approve it twice
      const request = await manager.getRepository(GradeEditRequest).findOne({
        where: { id: requestId, schoolId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request) {
        throw new NotFoundException('Cererea de editare nu a fost gasita');
      }
      if (request.status !== ConductStatus.PENDING) {
        throw new ConflictException('Cererea a fost deja solutionata');
      }

      request.directorReason = dto.directorReason;
      request.status = dto.approve
        ? ConductStatus.APPROVED
        : ConductStatus.REJECTED;
      const decided = await manager
        .getRepository(GradeEditRequest)
        .save(request);

      const student = await this.studentsService.getByIdOrFail(
        request.studentId,
      );
      const subject = await this.subjectsService.getByIdOrFail(
        request.subjectId,
      );
      const meta = {
        requestId: request.id,
        gradeId: request.gradeId,
        studentId: student.id,
        subjectId: subject.id,
        actorName: directorEmail,
        actorRole: Role.DIRECTOR,
      };

      if (dto.approve) {
        const before = Number(request.currentValue);
        const after = Number(request.proposedValue);
        await manager
          .getRepository(Grade)
          .update({ id: request.gradeId }, { value: after });

        await this.reportsService.create(
          {
            schoolId,
            teacherId: request.teacherId,
            type: ReportType.GRADE_UPDATE,
            description: `Nota editata pentru ${studentLabel(student)} la ${subject.name}: ${before} → ${after} (director: ${directorEmail})`,
            metadata: { ...meta, before, after },
          },
          manager,
        );
      }

      const verdict = dto.approve ? 'aprobata' : 'respinsa';
      await this.reportsService.create(
        {
          schoolId,
          teacherId: request.teacherId,
          type: ReportType.GRADE_EDIT_DECISION,
          description: `Cerere editare nota ${verdict} pentru ${studentLabel(student)} la ${subject.name} (director: ${directorEmail})`,
          metadata: {
            ...meta,
            status: decided.status,
            directorReason: dto.directorReason,
          },
        },
        manager,
      );

      return decided;
    });

    return {
      ...saved,
      currentValue: Number(saved.currentValue),
      proposedValue: Number(saved.proposedValue),
    };
  }
}
