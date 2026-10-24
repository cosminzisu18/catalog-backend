import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReportType } from '../../common/enums/report-type.enum';
import { School } from '../../schools/entities/school.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';

// paging goes by id (higher = newer); the school_id / teacher_id index
// also holds the primary key, so it covers WHERE + ORDER BY id
@Entity('activity_reports')
export class ActivityReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'school_id', type: 'int' })
  schoolId: number;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  // history stays even after the teacher is deleted
  @Index()
  @Column({ name: 'teacher_id', type: 'int', nullable: true })
  teacherId: number | null;

  @ManyToOne(() => Teacher, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: Teacher | null;

  @Column({ type: 'enum', enum: ReportType })
  type: ReportType;

  @Column({ type: 'text' })
  description: string;

  @Column({
    name: 'hours_delta',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  hoursDelta: number;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
