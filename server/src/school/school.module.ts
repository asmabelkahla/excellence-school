import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SchoolClass } from '../entities/class.entity';
import { ClassTeacher } from '../entities/class-teacher.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { ClassSubject, Subject } from '../academics/entities';
import { ClassesController, StudentsController } from './school.controller';
import { SchoolService } from './school.service';

@Module({
  imports: [TypeOrmModule.forFeature([Student, SchoolClass, ClassTeacher, User, ClassSubject, Subject]), AuthModule],
  controllers: [StudentsController, ClassesController],
  providers: [SchoolService],
})
export class SchoolModule {}
