import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AllowInactiveDirector } from '../common/decorators/allow-inactive-director.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SchoolId } from '../common/decorators/school-id.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateDirectorDto } from './dto/create-director.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { UpdateDirectorDto } from './dto/update-director.dto';
import { DirectorsService } from './directors.service';

@Controller('directors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DIRECTOR)
export class DirectorsController {
  constructor(private readonly directorsService: DirectorsService) {}

  @Get()
  list(@SchoolId() schoolId: number) {
    return this.directorsService.listForSchool(schoolId);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.directorsService.getByUserIdOrFail(user.id);
  }

  @AllowInactiveDirector()
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateDirectorDto) {
    return this.directorsService.updateMe(user.id, dto);
  }

  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateDirectorDto) {
    return this.directorsService.createForSchool(schoolId, dto);
  }

  @Patch(':id/activate')
  activate(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.directorsService.activate(schoolId, id);
  }

  @Patch(':id/active')
  setActive(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetActiveDto,
  ) {
    return this.directorsService.setActive(schoolId, id, dto.isActive);
  }
}
