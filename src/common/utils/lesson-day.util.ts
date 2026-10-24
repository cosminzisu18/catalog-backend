import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Absence } from '../../absences/entities/absence.entity';
import { Grade } from '../../grades/entities/grade.entity';
import { Student } from '../../students/entities/student.entity';

// A student gets either one grade or one absence per subject and day,
// never both. Call it inside the transaction that saves the entry: the
// student row is locked first, so two requests can't both pass the check.
export async function assertLessonDayFree(
  manager: EntityManager,
  entry: { studentId: number; subjectId: number; date: string },
): Promise<void> {
  await manager.getRepository(Student).findOne({
    where: { id: entry.studentId },
    lock: { mode: 'pessimistic_write' },
  });

  const same = { studentId: entry.studentId, subjectId: entry.subjectId };
  const hasGrade = await manager
    .getRepository(Grade)
    .exists({ where: { ...same, gradedOn: entry.date } });
  if (hasGrade) {
    throw new ConflictException(
      'Elevul are deja o nota la aceasta materie in ziua respectiva',
    );
  }

  const hasAbsence = await manager
    .getRepository(Absence)
    .exists({ where: { ...same, absentOn: entry.date } });
  if (hasAbsence) {
    throw new ConflictException(
      'Elevul are absenta la aceasta materie in ziua respectiva',
    );
  }
}
