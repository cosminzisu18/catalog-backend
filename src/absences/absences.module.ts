import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsModule } from '../reports/reports.module';
import { StudentsModule } from '../students/students.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { TeachersModule } from '../teachers/teachers.module';
import { TimetableModule } from '../timetable/timetable.module';
import { AbsencesController } from './absences.controller';
import { AbsencesService } from './absences.service';
import { Absence } from './entities/absence.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Absence]),
    TeachersModule,
    StudentsModule,
    SubjectsModule,
    TimetableModule,
    ReportsModule,
  ],
  controllers: [AbsencesController],
  providers: [AbsencesService],
})
export class AbsencesModule {}
