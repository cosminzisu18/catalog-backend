import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import {
  likePattern,
  normalizeListQuery,
  toPaginated,
  type PaginatedResult,
} from '../common/utils/pagination.util';
import { Student } from '../students/entities/student.entity';
import { TimetableSlot } from '../timetable/entities/timetable-slot.entity';
import { AssignStudentsDto } from './dto/assign-students.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { ListClassesQueryDto } from './dto/list-classes-query.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { SchoolClass } from './entities/school-class.entity';

type ClassWithCount = SchoolClass & { studentCount: number };

const SORT_COLUMNS: Record<string, string> = {
  name: 'class.name',
  createdAt: 'class.createdAt',
  studentCount: 'student_count',
};

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(SchoolClass)
    private readonly classesRepo: Repository<SchoolClass>,
    @InjectRepository(Student)
    private readonly studentsRepo: Repository<Student>,
    @InjectRepository(TimetableSlot)
    private readonly slotsRepo: Repository<TimetableSlot>,
  ) {}

  async create(schoolId: number, dto: CreateClassDto) {
    const name = dto.name.trim();
    const existing = await this.classesRepo.findOne({
      where: { schoolId, name },
    });
    if (existing) {
      throw new ConflictException('Clasa exista deja');
    }
    return this.classesRepo.save(
      this.classesRepo.create({
        schoolId,
        name,
        description: dto.description?.trim() || null,
      }),
    );
  }

  async list(
    schoolId: number,
    query: ListClassesQueryDto = {},
  ): Promise<PaginatedResult<ClassWithCount>> {
    const { page, pageSize, search, sortBy, sortOrder, skip } =
      normalizeListQuery(query);

    const qb = this.classesRepo
      .createQueryBuilder('class')
      .where('class.schoolId = :schoolId', { schoolId });

    if (search) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('class.name LIKE :q').orWhere('class.description LIKE :q');
        }),
      ).setParameter('q', likePattern(search));
    }

    const total = await qb.getCount();

    // student count comes from a subquery, so we can sort by it
    qb.addSelect(
      (sub) =>
        sub
          .select('COUNT(*)')
          .from(Student, 'student')
          .where('student.classId = class.id'),
      'student_count',
    )
      .orderBy(SORT_COLUMNS[sortBy] ?? SORT_COLUMNS.name, sortOrder)
      .addOrderBy('class.id', 'ASC')
      .offset(skip)
      .limit(pageSize);

    const { entities, raw } = await qb.getRawAndEntities<{
      student_count: string;
    }>();

    const items = entities.map((c, i) => ({
      ...c,
      studentCount: Number(raw[i]?.student_count ?? 0),
    }));

    return toPaginated(items, total, page, pageSize);
  }

  async lookup(schoolId: number) {
    return this.classesRepo.find({
      select: { id: true, name: true },
      where: { schoolId },
      order: { name: 'ASC' },
    });
  }

  async getByIdOrFail(schoolId: number, id: number) {
    const row = await this.classesRepo.findOne({ where: { id, schoolId } });
    if (!row) throw new NotFoundException('Clasa nu a fost gasita');
    return row;
  }

  async update(schoolId: number, id: number, dto: UpdateClassDto) {
    const row = await this.getByIdOrFail(schoolId, id);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name !== row.name) {
        const clash = await this.classesRepo.findOne({
          where: { schoolId, name },
        });
        if (clash && clash.id !== id) {
          throw new ConflictException('Exista deja o clasa cu acest nume');
        }
        row.name = name;
      }
    }
    if (dto.description !== undefined) {
      row.description = dto.description?.trim() || null;
    }

    // students and timetable point to the class by id, so a rename is one UPDATE
    return this.classesRepo.save(row);
  }

  async remove(schoolId: number, id: number) {
    const row = await this.getByIdOrFail(schoolId, id);
    const students = await this.studentsRepo.count({
      where: { schoolId, classId: id },
    });
    if (students > 0) {
      throw new BadRequestException(
        'Nu poti sterge clasa: are elevi asignati. Muta elevii mai intai.',
      );
    }
    const slots = await this.slotsRepo.count({
      where: { schoolId, classId: id },
    });
    if (slots > 0) {
      throw new BadRequestException(
        'Nu poti sterge clasa: exista ore in orar. Sterge orele mai intai.',
      );
    }
    await this.classesRepo.remove(row);
    return { ok: true };
  }

  async assignStudents(
    schoolId: number,
    classId: number,
    dto: AssignStudentsDto,
  ) {
    const schoolClass = await this.getByIdOrFail(schoolId, classId);
    const ids = [...new Set(dto.studentIds)];

    const found = await this.studentsRepo.count({
      where: { schoolId, id: In(ids) },
    });
    if (found !== ids.length) {
      throw new BadRequestException('Unii elevi nu apartin scolii');
    }

    await this.studentsRepo.update(
      { schoolId, id: In(ids) },
      { classId: schoolClass.id },
    );

    return {
      classId: schoolClass.id,
      className: schoolClass.name,
      assigned: ids.length,
    };
  }

  // teachers that have at least one lesson with this class
  async listTeachers(schoolId: number, classId: number) {
    await this.getByIdOrFail(schoolId, classId);
    return this.slotsRepo
      .createQueryBuilder('slot')
      .innerJoin('slot.teacher', 'teacher')
      .select('teacher.id', 'id')
      .addSelect('teacher.firstName', 'firstName')
      .addSelect('teacher.lastName', 'lastName')
      .where('slot.classId = :classId', { classId })
      .distinct(true)
      .orderBy('teacher.lastName', 'ASC')
      .addOrderBy('teacher.firstName', 'ASC')
      .getRawMany<{ id: number; firstName: string; lastName: string }>();
  }

  async listStudents(schoolId: number, classId: number) {
    await this.getByIdOrFail(schoolId, classId);
    return this.studentsRepo.find({
      where: { schoolId, classId },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }
}
