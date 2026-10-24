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
import { Student } from '../students/entities/student.entity';
import { StudentsService, studentLabel } from '../students/students.service';
import { SubjectsService } from '../subjects/subjects.service';
import { TeachersService } from '../teachers/teachers.service';
import { CreateConductRequestDto } from './dto/create-conduct-request.dto';
import { DecideConductRequestDto } from './dto/decide-conduct-request.dto';
import { ListConductQueryDto } from './dto/list-conduct-query.dto';
import { ConductRequest } from './entities/conduct-request.entity';

export type ConductRequestView = Omit<
  ConductRequest,
  'student' | 'teacher' | 'school'
> & {
  studentName: string;
  className: string;
  currentConduct: number;
  teacherName: string;
};

const SORT_COLUMNS = {
  createdAt: 'request.createdAt',
  proposedGrade: 'request.proposedGrade',
  status: 'request.status',
  studentName: 'student.lastName',
};

@Injectable()
export class ConductService {
  constructor(
    @InjectRepository(ConductRequest)
    private readonly conductRepo: Repository<ConductRequest>,
    private readonly teachersService: TeachersService,
    private readonly studentsService: StudentsService,
    private readonly subjectsService: SubjectsService,
    private readonly reportsService: ReportsService,
    private readonly dataSource: DataSource,
  ) {}

  private toView(request: ConductRequest): ConductRequestView {
    const { student, teacher, ...rest } = request;
    return {
      ...rest,
      proposedGrade: Number(request.proposedGrade),
      studentName: fullName(student),
      className: student?.schoolClass?.name ?? '',
      currentConduct: Number(student?.conductGrade ?? 0),
      teacherName: fullName(teacher),
    };
  }

  async createByTeacher(userId: number, dto: CreateConductRequestDto) {
    const teacher = await this.teachersService.getByUserIdOrFail(userId);
    const target = await this.studentsService.getByIdOrFail(dto.studentId);

    if (target.schoolId !== teacher.schoolId) {
      throw new ForbiddenException('Elevul nu este in scoala ta');
    }
    const teaches = await this.subjectsService.teacherTeachesStudent(
      teacher.id,
      target.id,
    );
    if (!teaches) {
      throw new ForbiddenException(
        'Poti cere scaderea purtarii doar pentru elevii tai',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // lock the student row: the conduct grade and requests can't change
      // until this transaction ends
      const student = await manager.getRepository(Student).findOneOrFail({
        where: { id: target.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (dto.proposedGrade >= Number(student.conductGrade)) {
        throw new BadRequestException(
          'Nota propusa trebuie sa fie mai mica decat purtarea actuala',
        );
      }

      const repo = manager.getRepository(ConductRequest);
      const pending = await repo.exists({
        where: {
          studentId: student.id,
          teacherId: teacher.id,
          status: ConductStatus.PENDING,
        },
      });
      if (pending) {
        throw new ConflictException(
          'Ai deja o cerere de purtare in asteptare pentru acest elev',
        );
      }

      const request = await repo.save(
        repo.create({
          schoolId: teacher.schoolId,
          studentId: student.id,
          teacherId: teacher.id,
          proposedGrade: dto.proposedGrade,
          teacherReason: dto.teacherReason,
          status: ConductStatus.PENDING,
        }),
      );

      const by = fullName(teacher);
      await this.reportsService.create(
        {
          schoolId: teacher.schoolId,
          teacherId: teacher.id,
          type: ReportType.CONDUCT_REQUEST,
          description: `Cerere scadere purtare pentru ${studentLabel(target)} la nota ${dto.proposedGrade} (de ${by})`,
          metadata: {
            requestId: request.id,
            studentId: student.id,
            proposedGrade: dto.proposedGrade,
            teacherReason: dto.teacherReason,
            actorName: by,
            actorRole: Role.TEACHER,
          },
        },
        manager,
      );

      return request;
    });
  }

  private baseQuery() {
    return this.conductRepo
      .createQueryBuilder('request')
      .innerJoin('request.student', 'student')
      .innerJoin('student.schoolClass', 'class')
      .innerJoin('request.teacher', 'teacher')
      .addSelect([
        'student.id',
        'student.firstName',
        'student.lastName',
        'student.conductGrade',
        'class.id',
        'class.name',
        'teacher.id',
        'teacher.firstName',
        'teacher.lastName',
      ]);
  }

  private async page(
    qb: ReturnType<ConductService['baseQuery']>,
    query: ListConductQueryDto,
    defaultOrder: 'ASC' | 'DESC',
  ): Promise<PaginatedResult<ConductRequestView>> {
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
            .orWhere('class.name LIKE :q')
            .orWhere('teacher.lastName LIKE :q')
            .orWhere('request.teacherReason LIKE :q');
        }),
      ).setParameter('q', likePattern(search));
    }

    const [items, total] = await qb
      .orderBy(resolveSort(sortBy, SORT_COLUMNS, 'createdAt'), sortOrder)
      .addOrderBy('request.id', 'ASC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return toPaginated(
      items.map((r) => this.toView(r)),
      total,
      page,
      pageSize,
    );
  }

  listPending(schoolId: number, query: ListConductQueryDto = {}) {
    const qb = this.baseQuery()
      .where('request.schoolId = :schoolId', { schoolId })
      .andWhere('request.status = :status', { status: ConductStatus.PENDING });
    return this.page(qb, query, 'ASC');
  }

  async listForTeacherUser(userId: number, query: ListConductQueryDto = {}) {
    const teacher = await this.teachersService.getByUserIdOrFail(userId);
    const qb = this.baseQuery().where('request.teacherId = :teacherId', {
      teacherId: teacher.id,
    });
    return this.page(qb, query, 'DESC');
  }

  async listForStudentUser(userId: number, query: ListConductQueryDto = {}) {
    const student = await this.studentsService.getByUserIdOrFail(userId);
    const qb = this.baseQuery().where('request.studentId = :studentId', {
      studentId: student.id,
    });
    return this.page(qb, query, 'DESC');
  }

  async decideByDirector(
    schoolId: number,
    requestId: number,
    dto: DecideConductRequestDto,
    directorEmail: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ConductRequest);
      const request = await repo.findOne({
        where: { id: requestId, schoolId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request) {
        throw new NotFoundException('Cererea de purtare nu a fost gasita');
      }
      if (request.status !== ConductStatus.PENDING) {
        throw new ConflictException('Cererea a fost deja solutionata');
      }

      const student = await manager.getRepository(Student).findOneOrFail({
        where: { id: request.studentId },
        lock: { mode: 'pessimistic_write' },
      });
      const proposed = Number(request.proposedGrade);

      // another approved request may have lowered the grade in the meantime
      if (dto.approve && proposed >= Number(student.conductGrade)) {
        throw new BadRequestException(
          `Purtarea elevului este deja ${Number(student.conductGrade)}; cererea nu o mai scade`,
        );
      }

      request.directorReason = dto.directorReason;
      request.status = dto.approve
        ? ConductStatus.APPROVED
        : ConductStatus.REJECTED;
      const saved = await repo.save(request);

      if (dto.approve) {
        await this.studentsService.setConductGrade(
          student.id,
          proposed,
          manager,
        );
      }

      const verdict = dto.approve ? 'aprobata' : 'respinsa';
      const label = studentLabel(
        await this.studentsService.getByIdOrFail(student.id, manager),
      );
      await this.reportsService.create(
        {
          schoolId,
          teacherId: request.teacherId,
          type: ReportType.CONDUCT_DECISION,
          description: `Cerere purtare ${verdict} pentru ${label}, nota ${proposed} (director: ${directorEmail})`,
          metadata: {
            requestId: request.id,
            studentId: student.id,
            status: saved.status,
            proposedGrade: proposed,
            directorReason: dto.directorReason,
            actorName: directorEmail,
            actorRole: Role.DIRECTOR,
          },
        },
        manager,
      );

      return { ...saved, proposedGrade: proposed };
    });
  }
}
