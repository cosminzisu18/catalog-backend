import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/entities/student.entity';
import { TimetableSlot } from '../timetable/entities/timetable-slot.entity';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { ClassTeacher } from './entities/class-teacher.entity';
import { SchoolClass } from './entities/school-class.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SchoolClass,
      Student,
      TimetableSlot,
      ClassTeacher,
    ]),
  ],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
