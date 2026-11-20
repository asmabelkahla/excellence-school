import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { StaffService } from './staff.service';

/** Staff accounts (admin, moderator, econome, teacher). Accounts are deactivated, never deleted. */
@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list() {
    return this.staff.list();
  }

  @Post()
  create(@Body() dto: CreateStaffDto, @Req() req: AuthenticatedRequest) {
    return this.staff.create(dto, req.user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @Req() req: AuthenticatedRequest) {
    return this.staff.update(id, dto, { id: req.user.sub });
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.staff.resetPassword(id, { id: req.user.sub });
  }
}
