import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassesModule } from '../classes/classes.module';
import { Grade } from '../grades/entities/grade.entity';
import { TimetableSlot } from '../timetable/entities/timetable-slot.entity';
import { UsersModule } from '../users/users.module';
import { Student } from './entities/student.entity';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, Grade, TimetableSlot]),
    UsersModule,
    ClassesModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
