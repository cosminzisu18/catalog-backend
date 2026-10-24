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
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { ListTeachersQueryDto } from './dto/list-teachers-query.dto';
import { LogHoursDto } from './dto/log-hours.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { TeachersService } from './teachers.service';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Roles(Role.DIRECTOR)
  @Get()
  list(@SchoolId() schoolId: number, @Query() query: ListTeachersQueryDto) {
    return this.teachersService.listBySchool(schoolId, query);
  }

  @Roles(Role.DIRECTOR)
  @Get('lookup')
  lookup(@SchoolId() schoolId: number) {
    return this.teachersService.lookupForSchool(schoolId);
  }

  @Roles(Role.DIRECTOR)
  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateTeacherDto) {
    return this.teachersService.createForSchool(schoolId, dto);
  }

  @Roles(Role.TEACHER)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.teachersService.getByUserIdOrFail(user.id);
  }

  @Roles(Role.TEACHER)
  @Post('me/hours')
  logHours(@CurrentUser() user: AuthUser, @Body() dto: LogHoursDto) {
    return this.teachersService.logHours(user.id, dto);
  }

  @Roles(Role.DIRECTOR)
  @Get(':id')
  getOne(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.teachersService.getViewForSchool(schoolId, id);
  }

  @Roles(Role.DIRECTOR)
  @Patch(':id')
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.teachersService.updateForSchool(schoolId, id, dto);
  }

  @Roles(Role.DIRECTOR)
  @Patch(':id/active')
  setActive(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetActiveDto,
  ) {
    return this.teachersService.setActiveForSchool(schoolId, id, dto.isActive);
  }

  @Roles(Role.DIRECTOR)
  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.teachersService.removeForSchool(schoolId, id);
  }
}
