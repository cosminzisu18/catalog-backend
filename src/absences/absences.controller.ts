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
import { AbsencesService } from './absences.service';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { ListAbsencesQueryDto } from './dto/list-absences-query.dto';
import { MotivateAbsenceDto } from './dto/motivate-absence.dto';

@Controller('absences')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbsencesController {
  constructor(private readonly absencesService: AbsencesService) {}

  @Roles(Role.TEACHER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAbsenceDto) {
    return this.absencesService.createByTeacher(user.id, dto);
  }

  @Roles(Role.TEACHER)
  @Get('mine')
  mineAsTeacher(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAbsencesQueryDto,
  ) {
    return this.absencesService.listForTeacher(user.id, query);
  }

  @Roles(Role.STUDENT)
  @Get('me')
  mineAsStudent(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAbsencesQueryDto,
  ) {
    return this.absencesService.listForStudentUser(user.id, query);
  }

  @Roles(Role.DIRECTOR)
  @Get()
  forSchool(
    @SchoolId() schoolId: number,
    @Query() query: ListAbsencesQueryDto,
  ) {
    return this.absencesService.listForSchool(schoolId, query);
  }

  @Roles(Role.DIRECTOR)
  @Patch(':id/motivate')
  motivate(
    @CurrentUser() user: AuthUser,
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MotivateAbsenceDto,
  ) {
    return this.absencesService.motivateByDirector(
      schoolId,
      id,
      dto,
      user.email,
    );
  }
}
