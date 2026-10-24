import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolClass } from '../classes/entities/school-class.entity';
import { GradeType } from '../common/enums/grade-type.enum';
import {
  generalAverage,
  roundedMean,
  subjectAverage,
  type SubjectAverage,
} from '../common/utils/average.util';
import { schoolYearStart } from '../common/utils/date.util';
import { groupBy } from '../common/utils/group-by.util';
import { getRomaniaDate } from '../common/utils/romania-time.util';
import { Student } from '../students/entities/student.entity';
import { Grade } from './entities/grade.entity';

export type SubjectReport = SubjectAverage & {
  subjectId: number;
  subjectName: string;
};

export type StudentReport = {
  studentId: number;
  firstName: string;
  lastName: string;
  classId: number;
  className: string;
  conductGrade: number;
  generalAverage: number | null;
  subjects: SubjectReport[];
};

export type RankedStudent = Omit<StudentReport, 'subjects'>;

export type StudentStats = StudentReport & {
  classAverage: number | null;
  // 1 = best, null without an average
  classRank: number | null;
  classSize: number;
};

export type ClassSummary = {
  classId: number;
  className: string;
  studentCount: number;
  average: number | null;
  best: RankedStudent | null;
};

type GradeRow = {
  studentId: number;
  subjectId: number;
  subjectName: string;
  value: string;
  type: GradeType;
};

const TOP_STUDENTS = 10;

function byAverageDesc(a: RankedStudent, b: RankedStudent) {
  return (b.generalAverage ?? -1) - (a.generalAverage ?? -1);
}

function withoutSubjects(report: StudentReport): RankedStudent {
  return {
    studentId: report.studentId,
    firstName: report.firstName,
    lastName: report.lastName,
    classId: report.classId,
    className: report.className,
    conductGrade: report.conductGrade,
    generalAverage: report.generalAverage,
  };
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradesRepo: Repository<Grade>,
    @InjectRepository(Student)
    private readonly studentsRepo: Repository<Student>,
    @InjectRepository(SchoolClass)
    private readonly classesRepo: Repository<SchoolClass>,
  ) {}

  private async loadStudents(
    schoolId: number,
    filter: { classId?: number; studentId?: number } = {},
  ): Promise<Student[]> {
    const qb = this.studentsRepo
      .createQueryBuilder('student')
      .innerJoinAndSelect('student.schoolClass', 'class')
      .where('student.schoolId = :schoolId', { schoolId });
    if (filter.classId) {
      qb.andWhere('student.classId = :classId', { classId: filter.classId });
    }
    if (filter.studentId) {
      qb.andWhere('student.id = :studentId', { studentId: filter.studentId });
    }
    return qb.getMany();
  }

  private async loadGrades(
    schoolId: number,
    filter: { classId?: number; studentId?: number } = {},
  ): Promise<GradeRow[]> {
    const qb = this.gradesRepo
      .createQueryBuilder('grade')
      .innerJoin('grade.subject', 'subject')
      .innerJoin('grade.student', 'student')
      .select('grade.studentId', 'studentId')
      .addSelect('grade.subjectId', 'subjectId')
      .addSelect('subject.name', 'subjectName')
      .addSelect('grade.value', 'value')
      .addSelect('grade.type', 'type')
      .where('grade.schoolId = :schoolId', { schoolId })
      .andWhere('grade.gradedOn >= :from', {
        from: schoolYearStart(getRomaniaDate()),
      });
    if (filter.classId) {
      qb.andWhere('student.classId = :classId', { classId: filter.classId });
    }
    if (filter.studentId) {
      qb.andWhere('grade.studentId = :studentId', {
        studentId: filter.studentId,
      });
    }
    const rows = await qb.getRawMany<GradeRow>();
    return rows.map((r) => ({
      ...r,
      studentId: Number(r.studentId),
      subjectId: Number(r.subjectId),
    }));
  }

  buildReports(students: Student[], grades: GradeRow[]): StudentReport[] {
    const byStudent = groupBy(grades, (g) => g.studentId);

    return students.map((student) => {
      const bySubject = groupBy(
        byStudent.get(student.id) ?? [],
        (g) => g.subjectId,
      );
      const subjects: SubjectReport[] = [...bySubject.values()]
        .map((rows) => ({
          subjectId: rows[0].subjectId,
          subjectName: rows[0].subjectName,
          ...subjectAverage(rows),
        }))
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

      return {
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        classId: student.classId,
        className: student.schoolClass?.name ?? '',
        conductGrade: Number(student.conductGrade),
        generalAverage: generalAverage(
          subjects.map((s) => s.final),
          student.conductGrade,
        ),
        subjects,
      };
    });
  }

  private async classReports(schoolId: number, classId: number) {
    const [students, grades] = await Promise.all([
      this.loadStudents(schoolId, { classId }),
      this.loadGrades(schoolId, { classId }),
    ]);
    return this.buildReports(students, grades);
  }

  private classAverage(reports: StudentReport[]): number | null {
    return roundedMean(
      reports
        .map((r) => r.generalAverage)
        .filter((a): a is number => a !== null),
    );
  }

  private async statsFor(student: Student): Promise<StudentStats> {
    const classmates = await this.classReports(
      student.schoolId,
      student.classId,
    );
    const mine = classmates.find((r) => r.studentId === student.id)!;
    const better = classmates.filter(
      (r) =>
        mine.generalAverage !== null &&
        r.generalAverage !== null &&
        r.generalAverage > mine.generalAverage,
    ).length;

    return {
      ...mine,
      classAverage: this.classAverage(classmates),
      classRank: mine.generalAverage === null ? null : better + 1,
      classSize: classmates.length,
    };
  }

  async forStudentUser(userId: number): Promise<StudentStats> {
    const student = await this.studentsRepo.findOne({ where: { userId } });
    if (!student) {
      throw new NotFoundException('Profilul de elev nu a fost gasit');
    }
    return this.statsFor(student);
  }

  async forStudentInSchool(
    schoolId: number,
    studentId: number,
  ): Promise<StudentStats> {
    const student = await this.studentsRepo.findOne({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Elevul nu a fost gasit');
    }
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('Elevul nu este in scoala ta');
    }
    return this.statsFor(student);
  }

  async classesOverview(schoolId: number): Promise<{
    classes: ClassSummary[];
    topStudents: RankedStudent[];
  }> {
    const [classes, students, grades] = await Promise.all([
      this.classesRepo.find({ where: { schoolId }, order: { name: 'ASC' } }),
      this.loadStudents(schoolId),
      this.loadGrades(schoolId),
    ]);
    const reports = this.buildReports(students, grades);

    const summaries = classes.map((schoolClass) => {
      const inClass = reports.filter((r) => r.classId === schoolClass.id);
      const ranked = inClass
        .filter((r) => r.generalAverage !== null)
        .map(withoutSubjects)
        .sort(byAverageDesc);
      return {
        classId: schoolClass.id,
        className: schoolClass.name,
        studentCount: inClass.length,
        average: this.classAverage(inClass),
        best: ranked[0] ?? null,
      };
    });

    const topStudents = reports
      .filter((r) => r.generalAverage !== null)
      .map(withoutSubjects)
      .sort(byAverageDesc)
      .slice(0, TOP_STUDENTS);

    return { classes: summaries, topStudents };
  }

  async classDetail(schoolId: number, classId: number) {
    const schoolClass = await this.classesRepo.findOne({
      where: { id: classId, schoolId },
    });
    if (!schoolClass) {
      throw new NotFoundException('Clasa nu a fost gasita');
    }

    const reports = await this.classReports(schoolId, classId);

    const bySubject = groupBy(
      reports.flatMap((r) => r.subjects).filter((s) => s.final !== null),
      (s) => s.subjectId,
    );

    return {
      classId: schoolClass.id,
      className: schoolClass.name,
      average: this.classAverage(reports),
      students: reports.map(withoutSubjects).sort(byAverageDesc),
      subjects: [...bySubject.values()]
        .map((rows) => ({
          subjectId: rows[0].subjectId,
          subjectName: rows[0].subjectName,
          average: roundedMean(rows.map((s) => s.final!)),
          studentCount: rows.length,
        }))
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
    };
  }
}
