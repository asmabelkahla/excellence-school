import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { SchoolModule } from './school/school.module';
import { ACADEMIC_ENTITIES, AcademicsModule } from './academics/academics.module';
import { MESSAGING_ENTITIES, MessagingModule } from './messaging/messaging.module';
import { NOTIFICATION_ENTITIES, NotificationsModule } from './notifications/notifications.module';
import { CalendarModule, SchoolEvent } from './calendar/calendar';
import { User } from './entities/user.entity';
import { Student } from './entities/student.entity';
import { SchoolClass } from './entities/class.entity';
import { ParentStudent } from './entities/parent-student.entity';
import { LinkRequest } from './entities/link-request.entity';
import { StaffInvitation } from './entities/staff-invitation.entity';
import { ClassTeacher } from './entities/class-teacher.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    // Global rate limit: 100 requests / minute / IP (auth routes are stricter).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const useSsl = config.get<string>('DB_SSL', 'false') === 'true';
        return {
          type: 'postgres' as const,
          ...(databaseUrl
            ? { url: databaseUrl }
            : {
                host: config.get<string>('DB_HOST', 'localhost'),
                port: Number(config.get<string>('DB_PORT', '5434')),
                username: config.get<string>('DB_USER', 'postgres'),
                password: config.get<string>('DB_PASSWORD', 'postgres'),
                database: config.get<string>('DB_NAME', 'excellence_db'),
              }),
          entities: [User, Student, SchoolClass, ClassTeacher, ParentStudent, LinkRequest, StaffInvitation, ...ACADEMIC_ENTITIES, ...MESSAGING_ENTITIES, ...NOTIFICATION_ENTITIES, SchoolEvent],
          migrations: ['dist/migrations/*.js'],
          synchronize: config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
          migrationsRun: false,
          logging: config.get<string>('DB_LOGGING', 'false') === 'true',
          // Neon / Render Postgres require TLS.
          ssl: useSsl ? { rejectUnauthorized: false } : false,
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User]),
    AuthModule,
    SchoolModule,
    AcademicsModule,
    MessagingModule,
    NotificationsModule,
    CalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
