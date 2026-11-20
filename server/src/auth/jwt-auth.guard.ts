import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string | null;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';
const ALLOW_PENDING_PASSWORD_KEY = 'allowPendingPasswordChange';

/** Lets a user who must change their password still reach this route (e.g. /auth/me). */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);

/**
 * Verifies the JWT, then re-reads the account on every request so that
 * deactivation, role changes and password resets take effect immediately
 * instead of when the token expires.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token absent ou invalide.');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(authHeader.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré.');
    }

    const user = await this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.role', 'u.email', 'u.active', 'u.must_change_password'])
      .addSelect('u.tokens_valid_after')
      .where('u.id = :id', { id: payload.sub })
      .getOne();

    if (!user || !user.active) {
      throw new UnauthorizedException('Compte désactivé ou introuvable.');
    }
    // JWT `iat` is in whole seconds: compare at that precision.
    if (user.tokens_valid_after && (payload.iat ?? 0) < Math.floor(user.tokens_valid_after.getTime() / 1000)) {
      throw new UnauthorizedException('Session expirée : reconnectez-vous.');
    }

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (user.must_change_password && !allowPending) {
      throw new ForbiddenException({
        statusCode: 403,
        code: PASSWORD_CHANGE_REQUIRED,
        message: 'Vous devez changer votre mot de passe avant de continuer.',
      });
    }

    // The database is the source of truth for the role, not the (possibly stale) token.
    req.user = { ...payload, role: user.role, email: user.email };
    return true;
  }
}
