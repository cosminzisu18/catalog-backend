import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AbsencesModule } from './absences/absences.module';
import { AuthModule } from './auth/auth.module';
import { ClassesModule } from './classes/classes.module';
import { validateEnv } from './config/env.validation';
import { ConductModule } from './conduct/conduct.module';
import { DatabaseModule } from './database/database.module';
import { DirectorsModule } from './directors/directors.module';
import { GradesModule } from './grades/grades.module';
import { ReportsModule } from './reports/reports.module';
import { SchoolsModule } from './schools/schools.module';
import { StudentsModule } from './students/students.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TeachersModule } from './teachers/teachers.module';
import { TimetableModule } from './timetable/timetable.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get('THROTTLE_TTL_MS') ?? 60000),
          limit: Number(config.get('THROTTLE_LIMIT') ?? 100),
        },
      ],
    }),
    DatabaseModule,
    UsersModule,
    SchoolsModule,
    DirectorsModule,
    AuthModule,
    TeachersModule,
    StudentsModule,
    ClassesModule,
    SubjectsModule,
    GradesModule,
    ConductModule,
    ReportsModule,
    TimetableModule,
    AbsencesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
