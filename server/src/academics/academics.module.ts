import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SchoolClass } from '../entities/class.entity';
import { ParentStudent } from '../entities/parent-student.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { HomeworkController, ParentReportCardsController, ReportCardsController, TeachingController } from './academics.controller';
import { ClassSubject, Domain, Grade, Homework, HomeworkDone, ReportCardEntity, Subject, SubjectComponent, SubjectRemark } from './entities';
import { HomeworkService } from './homework.service';
import { GradesService } from './grades.service';
import { ReportCardsService } from './report-cards.service';

export const ACADEMIC_ENTITIES = [Domain, Subject, SubjectComponent, ClassSubject, Grade, SubjectRemark, ReportCardEntity, Homework, HomeworkDone];

@Module({
  imports: [
    TypeOrmModule.forFeature([...ACADEMIC_ENTITIES, Student, SchoolClass, ParentStudent, User]),
    AuthModule,
  ],
  controllers: [TeachingController, ReportCardsController, ParentReportCardsController, HomeworkController],
  providers: [GradesService, ReportCardsService, HomeworkService],
})
export class AcademicsModule {}
