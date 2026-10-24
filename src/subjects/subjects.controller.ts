import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
import { CreateSubjectDto } from './dto/create-subject.dto';
import { ListSubjectsQueryDto } from './dto/list-subjects-query.dto';
import { SetTeacherSubjectsDto } from './dto/set-teacher-subjects.dto';
import { SubjectsService } from './subjects.service';

@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Roles(Role.DIRECTOR)
  @Get()
  list(@SchoolId() schoolId: number, @Query() query: ListSubjectsQueryDto) {
    return this.subjectsService.listBySchool(schoolId, query);
  }

  @Roles(Role.DIRECTOR, Role.TEACHER, Role.STUDENT)
  @Get('lookup')
  lookup(@CurrentUser() user: AuthUser, @SchoolId() schoolId: number) {
    return this.subjectsService.lookup(user, schoolId);
  }

  @Roles(Role.TEACHER)
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: ListSubjectsQueryDto) {
    return this.subjectsService.listForTeacherUser(user.id, query);
  }

  @Roles(Role.STUDENT)
  @Get('enrolled')
  enrolled(
    @CurrentUser() user: AuthUser,
    @Query() query: ListSubjectsQueryDto,
  ) {
    return this.subjectsService.listEnrolledForStudentUser(user.id, query);
  }

  @Roles(Role.DIRECTOR)
  @Get('for-student/:studentId')
  forStudent(
    @SchoolId() schoolId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.subjectsService.listSubjectsForStudent(schoolId, studentId);
  }

  @Roles(Role.DIRECTOR)
  @Get('teachers-for-slot')
  teachersForSlot(
    @SchoolId() schoolId: number,
    @Query('subjectId', ParseIntPipe) subjectId: number,
  ) {
    return this.subjectsService.teachersForSubject(schoolId, subjectId);
  }

  @Roles(Role.DIRECTOR)
  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(schoolId, dto);
  }

  @Roles(Role.DIRECTOR)
  @Put('teacher/:teacherId')
  setTeacherSubjects(
    @SchoolId() schoolId: number,
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Body() dto: SetTeacherSubjectsDto,
  ) {
    return this.subjectsService.setTeacherSubjects(
      schoolId,
      teacherId,
      dto.subjectIds,
    );
  }

  @Roles(Role.DIRECTOR)
  @Get('teacher/:teacherId')
  teacherSubjects(@Param('teacherId', ParseIntPipe) teacherId: number) {
    return this.subjectsService.listSubjectIdsForTeacher(teacherId);
  }

  @Roles(Role.DIRECTOR)
  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.subjectsService.removeForSchool(schoolId, id);
  }
}
