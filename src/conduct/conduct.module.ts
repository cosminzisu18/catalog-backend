import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsModule } from '../reports/reports.module';
import { StudentsModule } from '../students/students.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { TeachersModule } from '../teachers/teachers.module';
import { ConductController } from './conduct.controller';
import { ConductService } from './conduct.service';
import { ConductRequest } from './entities/conduct-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConductRequest]),
    TeachersModule,
    StudentsModule,
    SubjectsModule,
    ReportsModule,
  ],
  controllers: [ConductController],
  providers: [ConductService],
  exports: [ConductService],
})
export class ConductModule {}
