import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConductStatus } from '../../common/enums/conduct-status.enum';
import { School } from '../../schools/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { Subject } from '../../subjects/entities/subject.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';
import { Grade } from './grade.entity';

@Entity('grade_edit_requests')
@Index(['schoolId', 'status'])
export class GradeEditRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'school_id', type: 'int' })
  schoolId: number;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Index()
  @Column({ name: 'grade_id', type: 'int' })
  gradeId: number;

  @ManyToOne(() => Grade, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grade_id' })
  grade?: Grade;

  @Index()
  @Column({ name: 'student_id', type: 'int' })
  studentId: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Index()
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

  @Column({
    name: 'current_value',
    type: 'decimal',
    precision: 4,
    scale: 2,
  })
  currentValue: number;

  @Column({
    name: 'proposed_value',
    type: 'decimal',
    precision: 4,
    scale: 2,
  })
  proposedValue: number;

  @Column({ name: 'teacher_reason', type: 'text' })
  teacherReason: string;

  @Column({ name: 'director_reason', type: 'text', nullable: true })
  directorReason: string | null;

  @Column({ type: 'enum', enum: ConductStatus, default: ConductStatus.PENDING })
  status: ConductStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
