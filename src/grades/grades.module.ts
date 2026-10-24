import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolClass } from '../classes/entities/school-class.entity';
import { ReportsModule } from '../reports/reports.module';
import { Student } from '../students/entities/student.entity';
import { StudentsModule } from '../students/students.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { TeachersModule } from '../teachers/teachers.module';
import { TimetableModule } from '../timetable/timetable.module';
import { GradeEditRequest } from './entities/grade-edit-request.entity';
import { Grade } from './entities/grade.entity';
import { GradesController } from './grades.controller';
import { GradeEditRequestsService } from './grade-edit-requests.service';
import { GradesService } from './grades.service';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Grade, GradeEditRequest, Student, SchoolClass]),
    TeachersModule,
    SubjectsModule,
    StudentsModule,
    TimetableModule,
    ReportsModule,
  ],
  controllers: [GradesController, StatsController],
  providers: [GradesService, GradeEditRequestsService, StatsService],
  exports: [GradesService],
})
export class GradesModule {}
