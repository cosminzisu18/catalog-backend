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
import { Teacher } from '../../teachers/entities/teacher.entity';
import { Subject } from './subject.entity';

@Entity('teacher_subjects')
@Unique(['teacherId', 'subjectId'])
export class TeacherSubject {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'school_id', type: 'int' })
  schoolId: number;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'teacher_id', type: 'int' })
  teacherId: number;

  @ManyToOne(() => Teacher, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: Teacher;

  @Column({ name: 'subject_id', type: 'int' })
  subjectId: number;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject?: Subject;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
