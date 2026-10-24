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
import { Teacher } from '../../teachers/entities/teacher.entity';

@Entity('conduct_requests')
@Index(['schoolId', 'status'])
export class ConductRequest {
  @PrimaryGeneratedColumn()
  id: number;

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

  @Index()
  @Column({ name: 'teacher_id', type: 'int' })
  teacherId: number;

  @ManyToOne(() => Teacher, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: Teacher;

  @Column({
    name: 'proposed_grade',
    type: 'decimal',
    precision: 4,
    scale: 2,
  })
  proposedGrade: number;

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
