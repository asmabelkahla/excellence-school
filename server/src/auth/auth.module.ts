import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Student } from '../entities/student.entity';
import { SchoolClass } from '../entities/class.entity';
import { LinkRequest } from '../entities/link-request.entity';
import { StaffInvitation } from '../entities/staff-invitation.entity';
import { ParentStudent } from '../entities/parent-student.entity';
import { AuthController } from './auth.controller';
import { ParentSpaceController } from './parent-space.controller';
import { ParentSpaceService } from './parent-space.service';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Student, SchoolClass, ParentStudent, LinkRequest, StaffInvitation]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        const isProd = config.get<string>('NODE_ENV') === 'production';
        if (!secret || secret.length < 32) {
          if (isProd) {
            throw new Error('JWT_SECRET must be set (32+ characters) in production.');
          }
          // eslint-disable-next-line no-console
          console.warn('[auth] JWT_SECRET missing or too short — using an insecure dev secret.');
        }
        return {
          secret: secret || 'dev-only-insecure-secret-change-me-please-0000',
          signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1d') as any },
        };
      },
    }),
  ],
  controllers: [AuthController, StaffController, ParentsController, ParentSpaceController],
  providers: [AuthService, GoogleAuthService, StaffService, ParentsService, ParentSpaceService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
