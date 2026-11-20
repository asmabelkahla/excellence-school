import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DeclareChildDto } from './dto/declare-child.dto';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { ParentSpaceService } from './parent-space.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

/** The signed-in parent's own space. Every query is scoped to the token's user id. */
@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('parent')
export class ParentSpaceController {
  constructor(private readonly space: ParentSpaceService) {}

  @Get('children')
  children(@Req() req: AuthenticatedRequest) {
    return this.space.children(req.user.sub);
  }

  @Get('link-requests')
  myRequests(@Req() req: AuthenticatedRequest) {
    return this.space.myRequests(req.user.sub);
  }

  @Post('link-requests')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  declareChild(@Body() dto: DeclareChildDto, @Req() req: AuthenticatedRequest) {
    return this.space.declareChild(req.user.sub, dto);
  }

  @Get('classes')
  classes() {
    return this.space.classOptions();
  }
}
