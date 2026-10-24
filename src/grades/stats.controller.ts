import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SchoolId } from '../common/decorators/school-id.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StatsService } from './stats.service';

// everything here is for the current school year
@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Roles(Role.STUDENT)
  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.statsService.forStudentUser(user.id);
  }

  @Roles(Role.DIRECTOR)
  @Get('classes')
  classes(@SchoolId() schoolId: number) {
    return this.statsService.classesOverview(schoolId);
  }

  @Roles(Role.DIRECTOR)
  @Get('classes/:id')
  classDetail(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.statsService.classDetail(schoolId, id);
  }

  @Roles(Role.DIRECTOR)
  @Get('students/:id')
  student(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.statsService.forStudentInSchool(schoolId, id);
  }
}
