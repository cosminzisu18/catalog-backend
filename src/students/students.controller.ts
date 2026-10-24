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
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Roles(Role.DIRECTOR)
  @Get()
  list(@SchoolId() schoolId: number, @Query() query: ListStudentsQueryDto) {
    return this.studentsService.listBySchool(schoolId, query);
  }

  @Roles(Role.DIRECTOR, Role.TEACHER)
  @Get('lookup')
  lookup(@SchoolId() schoolId: number, @CurrentUser() user: AuthUser) {
    return this.studentsService.lookup(
      schoolId,
      user.role === Role.TEACHER ? user.id : undefined,
    );
  }

  @Roles(Role.DIRECTOR)
  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateStudentDto) {
    return this.studentsService.createForSchool(schoolId, dto);
  }

  @Roles(Role.STUDENT)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.studentsService.getProfileForUser(user.id);
  }

  @Roles(Role.DIRECTOR)
  @Get(':id')
  getOne(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.studentsService.getViewForSchool(schoolId, id);
  }

  @Roles(Role.DIRECTOR)
  @Patch(':id')
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.updateForSchool(schoolId, id, dto);
  }

  @Roles(Role.DIRECTOR)
  @Patch(':id/active')
  setActive(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetActiveDto,
  ) {
    return this.studentsService.setActiveForSchool(schoolId, id, dto.isActive);
  }

  @Roles(Role.DIRECTOR)
  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.studentsService.removeForSchool(schoolId, id);
  }
}
