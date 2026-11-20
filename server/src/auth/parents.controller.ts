import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ChildLinkDto, CreateParentDto, UpdateParentDto } from './dto/parent.dto';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { ParentsService } from './parents.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

/** Parent accounts and their links to students. Accounts are deactivated, never deleted. */
@Controller('parents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Get()
  list() {
    return this.parents.list();
  }

  @Post()
  create(@Body() dto: CreateParentDto, @Req() req: AuthenticatedRequest) {
    return this.parents.create(dto, req.user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateParentDto) {
    return this.parents.update(id, dto);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.parents.resetPassword(id);
  }

  @Post(':id/children')
  linkChild(@Param('id') id: string, @Body() dto: ChildLinkDto) {
    return this.parents.linkChild(id, dto);
  }

  @Delete(':id/children/:studentId')
  unlinkChild(@Param('id') id: string, @Param('studentId') studentId: string) {
    return this.parents.unlinkChild(id, studentId);
  }
}
