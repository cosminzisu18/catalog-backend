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
import { Roles } from '../common/decorators/roles.decorator';
import { SchoolId } from '../common/decorators/school-id.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AssignStudentsDto } from './dto/assign-students.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { ListClassesQueryDto } from './dto/list-classes-query.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ClassesService } from './classes.service';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Roles(Role.DIRECTOR, Role.TEACHER)
  @Get()
  list(@SchoolId() schoolId: number, @Query() query: ListClassesQueryDto) {
    return this.classesService.list(schoolId, query);
  }

  @Roles(Role.DIRECTOR, Role.TEACHER)
  @Get('lookup')
  lookup(@SchoolId() schoolId: number) {
    return this.classesService.lookup(schoolId);
  }

  @Roles(Role.DIRECTOR)
  @Post()
  create(@SchoolId() schoolId: number, @Body() dto: CreateClassDto) {
    return this.classesService.create(schoolId, dto);
  }

  @Roles(Role.DIRECTOR)
  @Get(':id/students')
  students(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.classesService.listStudents(schoolId, id);
  }

  @Roles(Role.DIRECTOR)
  @Post(':id/students')
  assign(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignStudentsDto,
  ) {
    return this.classesService.assignStudents(schoolId, id, dto);
  }

  @Roles(Role.DIRECTOR)
  @Get(':id/teachers')
  teachers(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.classesService.listTeachers(schoolId, id);
  }

  @Roles(Role.DIRECTOR)
  @Patch(':id')
  update(
    @SchoolId() schoolId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classesService.update(schoolId, id, dto);
  }

  @Roles(Role.DIRECTOR)
  @Delete(':id')
  remove(@SchoolId() schoolId: number, @Param('id', ParseIntPipe) id: number) {
    return this.classesService.remove(schoolId, id);
  }
}
