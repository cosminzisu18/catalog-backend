import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DirectorsModule } from '../directors/directors.module';
import { UsersModule } from '../users/users.module';
import { School } from './entities/school.entity';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  imports: [TypeOrmModule.forFeature([School]), UsersModule, DirectorsModule],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService, TypeOrmModule],
})
export class SchoolsModule {}
