import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SchoolId } from '../common/decorators/school-id.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles(Role.DIRECTOR)
  @Get()
  forDirector(
    @SchoolId() schoolId: number,
    @Query() query: ListReportsQueryDto,
  ) {
    return this.reportsService.list(
      { schoolId, teacherId: query.teacherId },
      query,
    );
  }

  @Roles(Role.TEACHER)
  @Get('mine')
  forTeacher(
    @CurrentUser() user: AuthUser,
    @Query() query: ListReportsQueryDto,
  ) {
    return this.reportsService.list({ teacherUserId: user.id }, query);
  }
}
