import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { ReportType } from '../common/enums/report-type.enum';
import { Role } from '../common/enums/role.enum';
import {
  likePattern,
  normalizeListQuery,
  paginate,
  resolveSort,
  toPaginated,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { ReportsService } from '../reports/reports.service';
import { UsersService } from '../users/users.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { ListTeachersQueryDto } from './dto/list-teachers-query.dto';
import { LogHoursDto } from './dto/log-hours.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { Teacher } from './entities/teacher.entity';

export type TeacherView = Omit<Teacher, 'user'> & {
  email: string;
  isActive: boolean;
};

export type TeacherOption = Pick<
  Teacher,
  'id' | 'firstName' | 'lastName' | 'hoursTaught'
> & { isActive: boolean };

const SORT_COLUMNS = {
  lastName: 'teacher.lastName',
  firstName: 'teacher.firstName',
  hoursTaught: 'teacher.hoursTaught',
  email: 'user.email',
  createdAt: 'teacher.createdAt',
};

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(Teacher)
    private readonly teachersRepo: Repository<Teacher>,
    private readonly usersService: UsersService,
    private readonly reportsService: ReportsService,
    private readonly dataSource: DataSource,
  ) {}

  // load only the user columns we need, so the password hash never
  // ends up in what we send to the client
  private withUser() {
    return this.teachersRepo
      .createQueryBuilder('teacher')
      .innerJoin('teacher.user', 'user')
      .addSelect(['user.id', 'user.email', 'user.isActive']);
  }

  private toView(teacher: Teacher): TeacherView {
    const { user, ...rest } = teacher;
    return {
      ...rest,
      hoursTaught: Number(teacher.hoursTaught),
      email: user?.email ?? '',
      isActive: user?.isActive ?? false,
    };
  }

  private async getViewOrFail(id: number): Promise<Teacher> {
    const teacher = await this.withUser()
      .where('teacher.id = :id', { id })
      .getOne();
    if (!teacher) {
      throw new NotFoundException('Profesorul nu a fost gasit');
    }
    return teacher;
  }

  private async assertInSchool(id: number, schoolId: number): Promise<Teacher> {
    const teacher = await this.getByIdOrFail(id);
    if (teacher.schoolId !== schoolId) {
      throw new ForbiddenException('Profesorul nu este in scoala ta');
    }
    return teacher;
  }

  async createForSchool(
    schoolId: number,
    dto: CreateTeacherDto,
  ): Promise<TeacherView> {
    await this.usersService.assertEmailAvailable(dto.email);

    // account and profile are created together or not at all
    return this.dataSource.transaction(async (manager) => {
      const user = await this.usersService.createUser(
        {
          email: dto.email,
          password: dto.temporaryPassword,
          role: Role.TEACHER,
          schoolId,
          mustChangePassword: true,
        },
        manager,
      );

      const repo = manager.getRepository(Teacher);
      const teacher = await repo.save(
        repo.create({
          userId: user.id,
          schoolId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          hoursTaught: 0,
        }),
      );

      return this.toView({ ...teacher, user });
    });
  }

  async listBySchool(
    schoolId: number,
    query: ListTeachersQueryDto = {},
  ): Promise<PaginatedResult<TeacherView>> {
    const { page, pageSize, search, sortBy, sortOrder } =
      normalizeListQuery(query);

    const qb = this.withUser().where('teacher.schoolId = :schoolId', {
      schoolId,
    });

    if (search) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('teacher.firstName LIKE :q')
            .orWhere('teacher.lastName LIKE :q')
            .orWhere('user.email LIKE :q');
        }),
      ).setParameter('q', likePattern(search));
    }

    if (query.isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy(resolveSort(sortBy, SORT_COLUMNS, 'lastName'), sortOrder)
      .addOrderBy('teacher.firstName', 'ASC')
      .addOrderBy('teacher.id', 'ASC');

    const result = await paginate(qb, page, pageSize);
    return toPaginated(
      result.items.map((t) => this.toView(t)),
      result.total,
      page,
      pageSize,
    );
  }

  async lookupForSchool(schoolId: number): Promise<TeacherOption[]> {
    const teachers = await this.teachersRepo
      .createQueryBuilder('teacher')
      .innerJoin('teacher.user', 'user')
      .select([
        'teacher.id',
        'teacher.firstName',
        'teacher.lastName',
        'teacher.hoursTaught',
        'user.id',
        'user.isActive',
      ])
      .where('teacher.schoolId = :schoolId', { schoolId })
      .orderBy('teacher.lastName', 'ASC')
      .addOrderBy('teacher.firstName', 'ASC')
      .getMany();

    return teachers.map((t) => ({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      hoursTaught: Number(t.hoursTaught),
      isActive: t.user?.isActive ?? false,
    }));
  }

  async getByIdOrFail(id: number): Promise<Teacher> {
    const teacher = await this.teachersRepo.findOne({ where: { id } });
    if (!teacher) {
      throw new NotFoundException('Profesorul nu a fost gasit');
    }
    return teacher;
  }

  async getByUserIdOrFail(userId: number): Promise<Teacher> {
    const teacher = await this.teachersRepo.findOne({ where: { userId } });
    if (!teacher) {
      throw new NotFoundException('Profilul de profesor nu a fost gasit');
    }
    return teacher;
  }

  async getViewForSchool(schoolId: number, id: number): Promise<TeacherView> {
    const teacher = await this.getViewOrFail(id);
    if (teacher.schoolId !== schoolId) {
      throw new ForbiddenException('Profesorul nu este in scoala ta');
    }
    return this.toView(teacher);
  }

  async logHours(userId: number, dto: LogHoursDto) {
    const teacher = await this.getByUserIdOrFail(userId);
    const by = `${teacher.firstName} ${teacher.lastName}`;

    await this.dataSource.transaction(async (manager) => {
      // UPDATE ... SET hours_taught = hours_taught + ?, no read-modify-write
      await manager
        .getRepository(Teacher)
        .increment({ id: teacher.id }, 'hoursTaught', dto.hours);

      await this.reportsService.create(
        {
          schoolId: teacher.schoolId,
          teacherId: teacher.id,
          type: ReportType.HOURS_LOG,
          description:
            dto.note?.trim() || `Inregistrare ${dto.hours} ore predare`,
          hoursDelta: dto.hours,
          metadata: {
            hours: dto.hours,
            actorName: by,
            actorRole: Role.TEACHER,
          },
        },
        manager,
      );
    });

    const updated = await this.getByIdOrFail(teacher.id);
    return { ...updated, hoursTaught: Number(updated.hoursTaught) };
  }

  async updateForSchool(
    schoolId: number,
    id: number,
    dto: UpdateTeacherDto,
  ): Promise<TeacherView> {
    const teacher = await this.assertInSchool(id, schoolId);

    await this.dataSource.transaction(async (manager) => {
      if (dto.firstName !== undefined) teacher.firstName = dto.firstName;
      if (dto.lastName !== undefined) teacher.lastName = dto.lastName;
      await manager.getRepository(Teacher).save(teacher);

      if (dto.email) {
        await this.usersService.updateEmail(teacher.userId, dto.email, manager);
      }
      if (dto.temporaryPassword) {
        await this.usersService.updatePassword(
          teacher.userId,
          dto.temporaryPassword,
          true,
          manager,
        );
      }
    });

    return this.getViewForSchool(schoolId, id);
  }

  async setActiveForSchool(
    schoolId: number,
    id: number,
    isActive: boolean,
  ): Promise<TeacherView> {
    const teacher = await this.assertInSchool(id, schoolId);
    await this.usersService.setActive(teacher.userId, isActive);
    return this.getViewForSchool(schoolId, id);
  }

  // one DELETE on the account: subjects, grades, requests and timetable
  // slots go by FK cascade; reports stay with teacher_id = null
  async removeForSchool(
    schoolId: number,
    id: number,
  ): Promise<{ deleted: true }> {
    const teacher = await this.assertInSchool(id, schoolId);
    await this.usersService.deleteById(teacher.userId);
    return { deleted: true };
  }
}
