import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SchoolId } from '../common/decorators/school-id.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { ListTimetableQueryDto } from './dto/list-timetable-query.dto';
import { UpdateTimetableSlotDto } from './dto/update-timetable-slot.dto';
import { TimetableService } from './timetable.service';

@Controller('timetable')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Roles(Role.DIRECTOR)
  @Get()
  list(@SchoolId() schoolId: number, @Query() query: ListTimetableQueryDto) {
    return this.timetableService.listForSchool(schoolId, query);
  }

  @Roles(Role.TEACHER)
  @Get('mine')
  mineAsTeacher(@CurrentUser() user: AuthUser) {
    return this.timetableService.listForTeacher(user.id);
  }

  @Roles(Role.STUDENT)
  @Get('my-class')
  mineAsStudent(@CurrentUser() user: AuthUser) {
    return this.timetableService.listForStudent(user.id);
  }

  @Roles(Role.TEACHER)
  @Get('lesson-check')
  lessonCheck(
    @CurrentUser() user: AuthUser,
    @Query('subjectId', ParseIntPipe) subjectId: number,
  ) {
    return this.timetableService.lessonCheckForUser(user.id, subjectId);
  }

  @Roles(Role.DIRECTOR)
  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateTimetableSlotDto) {
    return this.timetableService.create(schoolId, dto);
  }

  @Roles(Role.DIRECTOR)
  @Patch(':id')
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTimetableSlotDto,
  ) {
    return this.timetableService.update(schoolId, id, dto);
  }

  @Roles(Role.DIRECTOR)
  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.timetableService.remove(schoolId, id);
  }
}
