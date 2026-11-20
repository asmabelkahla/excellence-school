import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SaveSheetDto } from './dto/grades.dto';
import { CreateHomeworkDto, HomeworkDoneDto, UpdateHomeworkDto } from './dto/homework.dto';
import { HomeworkService } from './homework.service';
import { ClassTrimesterDto, UpdateReportCardDto } from './dto/report-cards.dto';
import { GradesService } from './grades.service';
import { ReportCardsService } from './report-cards.service';

const actorOf = (req: AuthenticatedRequest) => ({ id: req.user.sub, role: req.user.role });

/** Grade entry (teachers for their own subjects, admin for all). */
@Controller('teaching')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('teacher', 'admin')
export class TeachingController {
  constructor(private readonly grades: GradesService) {}

  @Get('assignments')
  assignments(@Req() req: AuthenticatedRequest) {
    return this.grades.assignments(actorOf(req));
  }

  @Get('class-subjects/:id/sheet')
  sheet(@Param('id') id: string, @Query() query: { trimester?: string }, @Req() req: AuthenticatedRequest) {
    const trimester = Number(query.trimester ?? 1);
    return this.grades.sheet(id, [1, 2, 3].includes(trimester) ? trimester : 1, actorOf(req));
  }

  @Put('class-subjects/:id/sheet')
  save(@Param('id') id: string, @Body() dto: SaveSheetDto, @Req() req: AuthenticatedRequest) {
    return this.grades.saveSheet(id, dto, actorOf(req));
  }
}

/** Bulletins: generation, review and publication by the administration. */
@Controller('report-cards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ReportCardsController {
  constructor(private readonly cards: ReportCardsService) {}

  @Get()
  list(@Query() query: ClassTrimesterDto) {
    return this.cards.listForClass(query.classId, query.trimester);
  }

  @Post('generate')
  generate(@Body() dto: ClassTrimesterDto) {
    return this.cards.generate(dto.classId, dto.trimester);
  }

  @Post('publish-all')
  publishAll(@Body() dto: ClassTrimesterDto) {
    return this.cards.publishAll(dto.classId, dto.trimester);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.cards.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReportCardDto) {
    return this.cards.update(id, dto);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.cards.publish(id);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.cards.unpublish(id);
  }
}

/** A parent reads the published bulletins of their own children only. */
@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('parent')
export class ParentReportCardsController {
  constructor(private readonly cards: ReportCardsService) {}

  @Get('children/:studentId/report-cards')
  list(@Param('studentId') studentId: string, @Req() req: AuthenticatedRequest) {
    return this.cards.forParent(req.user.sub, studentId);
  }
}

/** Homework: teachers manage their own, parents read their children's and tick them. */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  @Get('teaching/homework')
  @Roles('teacher', 'admin')
  list(@Req() req: AuthenticatedRequest) {
    return this.homework.listForTeacher(actorOf(req));
  }

  @Post('teaching/homework')
  @Roles('teacher', 'admin')
  create(@Body() dto: CreateHomeworkDto, @Req() req: AuthenticatedRequest) {
    return this.homework.create(dto, actorOf(req));
  }

  @Patch('teaching/homework/:id')
  @Roles('teacher', 'admin')
  update(@Param('id') id: string, @Body() dto: UpdateHomeworkDto, @Req() req: AuthenticatedRequest) {
    return this.homework.update(id, dto, actorOf(req));
  }

  @Delete('teaching/homework/:id')
  @Roles('teacher', 'admin')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.homework.remove(id, actorOf(req));
  }

  @Get('me/children/:studentId/homework')
  @Roles('parent')
  forChild(@Param('studentId') studentId: string, @Req() req: AuthenticatedRequest) {
    return this.homework.listForChild(req.user.sub, studentId);
  }

  @Put('me/children/:studentId/homework/:id/done')
  @Roles('parent')
  setDone(@Param('studentId') studentId: string, @Param('id') id: string, @Body() dto: HomeworkDoneDto, @Req() req: AuthenticatedRequest) {
    return this.homework.setDone(req.user.sub, studentId, id, dto.done);
  }
}
