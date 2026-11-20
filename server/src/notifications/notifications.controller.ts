import { Body, Controller, Delete, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

class PushKeysDto {
  @IsString() @IsNotEmpty() @MaxLength(200) p256dh: string;
  @IsString() @IsNotEmpty() @MaxLength(100) auth: string;
}

class PushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_tld: false }, { message: 'Abonnement push invalide.' })
  @MaxLength(1000)
  endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;

  // Sent by browsers in PushSubscription.toJSON(); not used.
  @IsOptional()
  expirationTime?: number | null;
}

class EndpointDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) endpoint: string;
}

/** Every signed-in user has notifications (only theirs). */
@Controller()
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(@Req() req: AuthenticatedRequest) {
    return this.notifications.list(req.user.sub);
  }

  @Get('notifications/unread-count')
  unread(@Req() req: AuthenticatedRequest) {
    return this.notifications.unreadCount(req.user.sub);
  }

  @Post('notifications/read-all')
  readAll(@Req() req: AuthenticatedRequest) {
    return this.notifications.markRead(req.user.sub);
  }

  @Post('notifications/:id/read')
  read(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notifications.markRead(req.user.sub, id);
  }

  @Get('push/public-key')
  publicKey() {
    return { publicKey: this.notifications.pushPublicKey };
  }

  @Post('push/subscribe')
  subscribe(@Body() dto: PushSubscriptionDto, @Req() req: AuthenticatedRequest, @Headers('user-agent') ua?: string) {
    return this.notifications.subscribe(req.user.sub, dto, ua);
  }

  @Delete('push/subscribe')
  unsubscribe(@Body() dto: EndpointDto, @Req() req: AuthenticatedRequest) {
    return this.notifications.unsubscribe(req.user.sub, dto.endpoint);
  }
}
