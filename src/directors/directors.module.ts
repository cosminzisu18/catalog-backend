import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../schools/entities/school.entity';
import { UsersModule } from '../users/users.module';
import { DirectorsController } from './directors.controller';
import { DirectorsService } from './directors.service';
import { Director } from './entities/director.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Director, School]), UsersModule],
  controllers: [DirectorsController],
  providers: [DirectorsService],
  exports: [DirectorsService, TypeOrmModule],
})
export class DirectorsModule {}
