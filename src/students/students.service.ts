import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, Repository } from 'typeorm';
import { ClassesService } from '../classes/classes.service';
import { Role } from '../common/enums/role.enum';
import { generalAverage, subjectAverage } from '../common/utils/average.util';
import { groupBy } from '../common/utils/group-by.util';
import {
  ageOn,
  isValidDate,
  schoolYearStart,
  toDbDate,
  toDisplayDate,
} from '../common/utils/date.util';
import {
  likePattern,
  normalizeListQuery,
  paginate,
  resolveSort,
  toPaginated,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { Grade } from '../grades/entities/grade.entity';
import { getRomaniaDate } from '../common/utils/romania-time.util';
import { Teacher } from '../teachers/entities/teacher.entity';
import { TimetableSlot } from '../timetable/entities/timetable-slot.entity';
import { UsersService } from '../users/users.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Student } from './entities/student.entity';

type StudentBase = Omit<Student, 'user' | 'schoolClass'> & {
  className: string;
  age: number | null;
};

const MIN_AGE = 5;
const MAX_AGE = 25;

export type StudentView = StudentBase & {
  email: string;
  isActive: boolean;
};

export type StudentProfile = StudentBase & {
  gradeCount: number;
  average: string | null;
};

export type StudentOption = Pick<
  StudentBase,
  'id' | 'firstName' | 'lastName' | 'classId' | 'className' | 'conductGrade'
> & { isActive: boolean };

const SORT_COLUMNS = {
  lastName: 'student.lastName',
  firstName: 'student.firstName',
  className: 'class.name',
  conductGrade: 'student.conductGrade',
  email: 'user.email',
  createdAt: 'student.createdAt',
};

// "Ana Pop (clasa 9A)", used in report descriptions
export function studentLabel(student: Student): string {
  const name = `${student.firstName} ${student.lastName}`;
  return student.schoolClass
    ? `${name} (clasa ${student.schoolClass.name})`
    : name;
}

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepo: Repository<Student>,
    @InjectRepository(Grade)
    private readonly gradesRepo: Repository<Grade>,
    private readonly usersService: UsersService,
    private readonly classesService: ClassesService,
    private readonly dataSource: DataSource,
  ) {}

  // only email and isActive are read from the user (never the password
  // hash); the class name comes from school_classes
  private withUserAndClass() {
    return this.studentsRepo
      .createQueryBuilder('student')
      .innerJoin('student.user', 'user')
      .innerJoin('student.schoolClass', 'class')
      .addSelect(['user.id', 'user.email', 'user.isActive'])
      .addSelect(['class.id', 'class.name']);
  }

  private toBase(student: Student): StudentBase {
    const { schoolClass, ...rest } = student;
    delete rest.user;
    return {
      ...rest,
      conductGrade: Number(student.conductGrade),
      birthDate: student.birthDate ? toDisplayDate(student.birthDate) : null,
      age: student.birthDate
        ? ageOn(student.birthDate, getRomaniaDate())
        : null,
      className: schoolClass?.name ?? '',
    };
  }

  private toView(student: Student): StudentView {
    return {
      ...this.toBase(student),
      email: student.user?.email ?? '',
      isActive: student.user?.isActive ?? false,
    };
  }

  private async assertInSchool(id: number, schoolId: number): Promise<Student> {
    const student = await this.getByIdOrFail(id);
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('Elevul nu este in scoala ta');
    }
    return student;
  }

  private parseBirthDate(value: string): string {
    if (!isValidDate(value)) {
      throw new BadRequestException('Data nasterii nu este valida');
    }
    const birthDate = toDbDate(value);
    const age = ageOn(birthDate, getRomaniaDate());
    if (age < MIN_AGE || age > MAX_AGE) {
      throw new BadRequestException(
        `Varsta elevului trebuie sa fie intre ${MIN_AGE} si ${MAX_AGE} ani`,
      );
    }
    return birthDate;
  }

  // same rules as the stats page, see average.util.ts
  private async gradeStats(student: Student) {
    const grades = await this.gradesRepo
      .createQueryBuilder('grade')
      .select(['grade.subjectId', 'grade.value', 'grade.type'])
      .where('grade.studentId = :studentId', { studentId: student.id })
      .andWhere('grade.gradedOn >= :from', {
        from: schoolYearStart(getRomaniaDate()),
      })
      .getMany();

    const bySubject = groupBy(grades, (g) => g.subjectId);
    const finals = [...bySubject.values()].map((g) => subjectAverage(g).final);
    const average = generalAverage(finals, student.conductGrade);

    return {
      gradeCount: grades.length,
      average: average === null ? null : average.toFixed(2),
    };
  }

  async createForSchool(
    schoolId: number,
    dto: CreateStudentDto,
  ): Promise<StudentView> {
    await this.usersService.assertEmailAvailable(dto.email);
    const schoolClass = await this.classesService.getByIdOrFail(
      schoolId,
      dto.classId,
    );

    const id = await this.dataSource.transaction(async (manager) => {
      const user = await this.usersService.createUser(
        {
          email: dto.email,
          password: dto.temporaryPassword,
          role: Role.STUDENT,
          schoolId,
          mustChangePassword: true,
        },
        manager,
      );

      const repo = manager.getRepository(Student);
      const student = await repo.save(
        repo.create({
          userId: user.id,
          schoolId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          classId: schoolClass.id,
          birthDate: dto.birthDate ? this.parseBirthDate(dto.birthDate) : null,
          conductGrade: 10,
        }),
      );
      return student.id;
    });

    return this.getViewForSchool(schoolId, id);
  }

  async listBySchool(
    schoolId: number,
    query: ListStudentsQueryDto = {},
  ): Promise<PaginatedResult<StudentView>> {
    const { page, pageSize, search, sortBy, sortOrder } =
      normalizeListQuery(query);

    const qb = this.withUserAndClass().where('student.schoolId = :schoolId', {
      schoolId,
    });

    if (search) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('student.firstName LIKE :q')
            .orWhere('student.lastName LIKE :q')
            .orWhere('class.name LIKE :q')
            .orWhere('user.email LIKE :q');
        }),
      ).setParameter('q', likePattern(search));
    }

    if (query.classId) {
      qb.andWhere('student.classId = :classId', { classId: query.classId });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy(resolveSort(sortBy, SORT_COLUMNS, 'lastName'), sortOrder)
      .addOrderBy('student.firstName', 'ASC')
      .addOrderBy('student.id', 'ASC');

    const result = await paginate(qb, page, pageSize);
    return toPaginated(
      result.items.map((s) => this.toView(s)),
      result.total,
      page,
      pageSize,
    );
  }

  // the director sees every student in the school, a teacher only the
  // students from classes where they have lessons
  async lookup(
    schoolId: number,
    teacherUserId?: number,
  ): Promise<StudentOption[]> {
    const qb = this.studentsRepo
      .createQueryBuilder('student')
      .innerJoin('student.user', 'user')
      .innerJoin('student.schoolClass', 'class')
      .select([
        'student.id',
        'student.firstName',
        'student.lastName',
        'student.classId',
        'student.conductGrade',
        'user.id',
        'user.isActive',
        'class.id',
        'class.name',
      ])
      .where('student.schoolId = :schoolId', { schoolId });

    if (teacherUserId) {
      qb.andWhere((sub) => {
        const linked = sub
          .subQuery()
          .select('1')
          .from(TimetableSlot, 'slot')
          .innerJoin(Teacher, 'teacher', 'teacher.id = slot.teacherId')
          .where('slot.classId = student.classId')
          .andWhere('teacher.userId = :teacherUserId')
          .getQuery();
        return `EXISTS ${linked}`;
      }).setParameter('teacherUserId', teacherUserId);
    }

    const students = await qb
      .orderBy('student.lastName', 'ASC')
      .addOrderBy('student.firstName', 'ASC')
      .getMany();

    return students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      classId: s.classId,
      className: s.schoolClass?.name ?? '',
      conductGrade: Number(s.conductGrade),
      isActive: s.user?.isActive ?? false,
    }));
  }

  // the class is always loaded, its name is used in reports and labels
  async getByIdOrFail(id: number, manager?: EntityManager): Promise<Student> {
    const repo = manager ? manager.getRepository(Student) : this.studentsRepo;
    const student = await repo.findOne({
      where: { id },
      relations: { schoolClass: true },
    });
    if (!student) {
      throw new NotFoundException('Elevul nu a fost gasit');
    }
    return student;
  }

  async getByUserIdOrFail(userId: number): Promise<Student> {
    const student = await this.studentsRepo.findOne({
      where: { userId },
      relations: { schoolClass: true },
    });
    if (!student) {
      throw new NotFoundException('Profilul de elev nu a fost gasit');
    }
    return student;
  }

  async getProfileForUser(userId: number): Promise<StudentProfile> {
    const student = await this.getByUserIdOrFail(userId);
    return {
      ...this.toBase(student),
      ...(await this.gradeStats(student)),
    };
  }

  async getViewForSchool(
    schoolId: number,
    id: number,
  ): Promise<StudentView & { gradeCount: number; average: string | null }> {
    const student = await this.withUserAndClass()
      .where('student.id = :id', { id })
      .getOne();
    if (!student) {
      throw new NotFoundException('Elevul nu a fost gasit');
    }
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('Elevul nu este in scoala ta');
    }
    return {
      ...this.toView(student),
      ...(await this.gradeStats(student)),
    };
  }

  async setConductGrade(
    studentId: number,
    grade: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(Student) : this.studentsRepo;
    await repo.update(studentId, { conductGrade: grade });
  }

  async updateForSchool(
    schoolId: number,
    id: number,
    dto: UpdateStudentDto,
  ): Promise<StudentView> {
    const student = await this.assertInSchool(id, schoolId);
    if (dto.classId !== undefined) {
      await this.classesService.getByIdOrFail(schoolId, dto.classId);
    }
    const birthDate = dto.birthDate
      ? this.parseBirthDate(dto.birthDate)
      : undefined;

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Student).update(student.id, {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.classId !== undefined && { classId: dto.classId }),
        ...(birthDate !== undefined && { birthDate }),
      });

      if (dto.email) {
        await this.usersService.updateEmail(student.userId, dto.email, manager);
      }
      if (dto.temporaryPassword) {
        await this.usersService.updatePassword(
          student.userId,
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
  ): Promise<StudentView> {
    const student = await this.assertInSchool(id, schoolId);
    await this.usersService.setActive(student.userId, isActive);
    return this.getViewForSchool(schoolId, id);
  }

  // the student's grades and requests are removed by FK cascade
  async removeForSchool(
    schoolId: number,
    id: number,
  ): Promise<{ deleted: true }> {
    const student = await this.assertInSchool(id, schoolId);
    await this.usersService.deleteById(student.userId);
    return { deleted: true };
  }
}
