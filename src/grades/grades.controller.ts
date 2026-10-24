import {
  Body,
  Controller,
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
import { CreateGradeDto } from './dto/create-grade.dto';
import { CreateGradeEditRequestDto } from './dto/create-grade-edit-request.dto';
import { DecideGradeEditRequestDto } from './dto/decide-grade-edit-request.dto';
import { ListGradesQueryDto } from './dto/list-grades-query.dto';
import { GradeEditRequestsService } from './grade-edit-requests.service';
import { GradesService } from './grades.service';

@Controller('grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradesController {
  constructor(
    private readonly gradesService: GradesService,
    private readonly editRequestsService: GradeEditRequestsService,
  ) {}

  @Roles(Role.TEACHER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGradeDto) {
    return this.gradesService.createByTeacher(user.id, dto);
  }

  @Roles(Role.TEACHER)
  @Post(':id/edit-requests')
  requestEdit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateGradeEditRequestDto,
  ) {
    return this.editRequestsService.requestEditByTeacher(user.id, id, dto);
  }

  @Roles(Role.TEACHER)
  @Get('edit-requests/mine')
  myEditRequests(
    @CurrentUser() user: AuthUser,
    @Query() query: ListGradesQueryDto,
  ) {
    return this.editRequestsService.listEditRequestsForTeacher(user.id, query);
  }

  @Roles(Role.DIRECTOR)
  @Get('edit-requests/pending')
  pendingEditRequests(
    @SchoolId() schoolId: number,
    @Query() query: ListGradesQueryDto,
  ) {
    return this.editRequestsService.listPendingEditRequests(schoolId, query);
  }

  @Roles(Role.DIRECTOR)
  @Patch('edit-requests/:id/decide')
  decideEdit(
    @CurrentUser() user: AuthUser,
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecideGradeEditRequestDto,
  ) {
    return this.editRequestsService.decideEditByDirector(
      schoolId,
      id,
      dto,
      user.email,
    );
  }

  @Roles(Role.TEACHER)
  @Get('mine')
  mineAsTeacher(
    @CurrentUser() user: AuthUser,
    @Query() query: ListGradesQueryDto,
  ) {
    return this.gradesService.listForTeacher(user.id, query);
  }

  @Roles(Role.STUDENT)
  @Get('my-grades')
  mineAsStudent(
    @CurrentUser() user: AuthUser,
    @Query() query: ListGradesQueryDto,
  ) {
    return this.gradesService.listForStudentUser(user.id, query);
  }

  @Roles(Role.DIRECTOR)
  @Get('student/:studentId')
  forStudent(
    @SchoolId() schoolId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() query: ListGradesQueryDto,
  ) {
    return this.gradesService.listForStudentInSchool(
      schoolId,
      studentId,
      query,
    );
  }
}
