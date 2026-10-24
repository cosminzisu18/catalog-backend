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
import { ConductService } from './conduct.service';
import { CreateConductRequestDto } from './dto/create-conduct-request.dto';
import { DecideConductRequestDto } from './dto/decide-conduct-request.dto';
import { ListConductQueryDto } from './dto/list-conduct-query.dto';

@Controller('conduct')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConductController {
  constructor(private readonly conductService: ConductService) {}

  @Roles(Role.TEACHER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConductRequestDto) {
    return this.conductService.createByTeacher(user.id, dto);
  }

  @Roles(Role.TEACHER)
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: ListConductQueryDto) {
    return this.conductService.listForTeacherUser(user.id, query);
  }

  @Roles(Role.STUDENT)
  @Get('my-history')
  myHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: ListConductQueryDto,
  ) {
    return this.conductService.listForStudentUser(user.id, query);
  }

  @Roles(Role.DIRECTOR)
  @Get('pending')
  pending(@SchoolId() schoolId: number, @Query() query: ListConductQueryDto) {
    return this.conductService.listPending(schoolId, query);
  }

  @Roles(Role.DIRECTOR)
  @Patch(':id/decide')
  decide(
    @CurrentUser() user: AuthUser,
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecideConductRequestDto,
  ) {
    return this.conductService.decideByDirector(schoolId, id, dto, user.email);
  }
}
