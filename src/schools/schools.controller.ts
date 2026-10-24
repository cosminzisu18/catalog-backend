import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { SchoolId } from '../common/decorators/school-id.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolsService } from './schools.service';

@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get('by-slug/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.schoolsService.getPublicBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DIRECTOR)
  @Get('me')
  getMySchool(@SchoolId() schoolId: number) {
    return this.schoolsService.getByIdOrFail(schoolId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DIRECTOR)
  @Patch('me')
  updateMySchool(@SchoolId() schoolId: number, @Body() dto: UpdateSchoolDto) {
    return this.schoolsService.updateSchool(schoolId, dto);
  }
}
