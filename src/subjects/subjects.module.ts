import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';
import { TimetableSlot } from '../timetable/entities/timetable-slot.entity';
import { Subject } from './entities/subject.entity';
import { TeacherSubject } from './entities/teacher-subject.entity';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subject, TeacherSubject, TimetableSlot]),
    TeachersModule,
    StudentsModule,
  ],
  controllers: [SubjectsController],
  providers: [SubjectsService],
  exports: [SubjectsService, TypeOrmModule],
})
export class SubjectsModule {}
