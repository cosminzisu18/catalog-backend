import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { Subject } from '../../subjects/entities/subject.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';

@Entity('absences')
@Unique(['studentId', 'subjectId', 'absentOn'])
export class Absence {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'school_id', type: 'int' })
  schoolId: number;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Index()
  @Column({ name: 'student_id', type: 'int' })
  studentId: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ name: 'subject_id', type: 'int' })
  subjectId: number;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject?: Subject;

  @Index()
  @Column({ name: 'teacher_id', type: 'int' })
  teacherId: number;

  @ManyToOne(() => Teacher, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: Teacher;

  @Column({ name: 'absent_on', type: 'date' })
  absentOn: string;

  // only the director can motivate an absence
  @Column({ type: 'boolean', default: false })
  motivated: boolean;

  @Column({
    name: 'motivated_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  motivatedReason: string | null;

  @Column({ name: 'motivated_at', type: 'datetime', nullable: true })
  motivatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
