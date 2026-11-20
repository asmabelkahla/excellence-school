import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { SchoolService } from './school.service';

/** Staff can read the school structure; only the administration can change it. */
const READERS = ['admin', 'moderator', 'econome'] as const;

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly school: SchoolService) {}

  @Get()
  @Roles(...READERS)
  list() {
    return this.school.listStudents();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateStudentDto) {
    return this.school.createStudent(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.school.updateStudent(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.school.deleteStudent(id);
  }
}

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly school: SchoolService) {}

  @Get()
  @Roles(...READERS)
  list() {
    return this.school.listClasses();
  }

  // Declared before ':id' routes so "teachers" is never read as an id.
  @Get('teachers')
  @Roles('admin')
  teachers() {
    return this.school.listTeachers();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateClassDto) {
    return this.school.createClass(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.school.updateClass(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.school.deleteClass(id);
  }
}
