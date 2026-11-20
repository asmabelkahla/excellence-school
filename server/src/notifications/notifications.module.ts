import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../entities/user.entity';
import { NotificationEntity, PushSubscriptionEntity } from './entities';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

export const NOTIFICATION_ENTITIES = [NotificationEntity, PushSubscriptionEntity];

/** Global: any feature module can inject NotificationsService to notify users. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([...NOTIFICATION_ENTITIES, User]), AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
