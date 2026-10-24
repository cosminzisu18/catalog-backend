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
import { SchoolClass } from './school-class.entity';

// not used by the app yet, teachers reach a class through the timetable
@Entity('class_teachers')
@Unique(['classId', 'teacherId'])
export class ClassTeacher {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'school_id', type: 'int' })
  schoolId: number;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'class_id', type: 'int' })
  classId: number;

  @ManyToOne(() => SchoolClass, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  schoolClass?: SchoolClass;

  @Column({ name: 'teacher_id', type: 'int' })
  teacherId: number;

  @ManyToOne(() => Teacher, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: Teacher;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
