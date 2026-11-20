import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PostMessageDto, StartConversationDto } from './messages.dto';
import { MessagingService } from './messaging.service';

const actorOf = (req: AuthenticatedRequest) => ({ id: req.user.sub, role: req.user.role });

/** Parent <-> teacher messaging. Deliberately not open to the admin: these threads are private. */
@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('parent', 'teacher')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('contacts')
  contacts(@Req() req: AuthenticatedRequest) {
    return this.messaging.contacts(actorOf(req));
  }

  @Get('unread-count')
  unread(@Req() req: AuthenticatedRequest) {
    return this.messaging.unreadCount(actorOf(req));
  }

  @Get('conversations')
  list(@Req() req: AuthenticatedRequest) {
    return this.messaging.list(actorOf(req));
  }

  @Post('conversations')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  start(@Body() dto: StartConversationDto, @Req() req: AuthenticatedRequest) {
    return this.messaging.start(dto, actorOf(req));
  }

  @Get('conversations/:id')
  thread(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.messaging.thread(id, actorOf(req));
  }

  @Post('conversations/:id/messages')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  post(@Param('id') id: string, @Body() dto: PostMessageDto, @Req() req: AuthenticatedRequest) {
    return this.messaging.post(id, dto, actorOf(req));
  }
}
