import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * Rate limits that do not punish families sharing one internet address.
 *
 * Many parents reach the API from the same IP: the school Wi-Fi during a meeting,
 * or a mobile operator that puts thousands of subscribers behind one address.
 * Counting only by IP would block all of them at once. So:
 *  - signed-in requests are counted per account, not per IP;
 *  - anonymous requests are counted per IP, with room for a crowd;
 *  - login attempts are also counted per account (identifier), which is what
 *    actually stops password guessing, from one address or from many.
 */

type Req = { ip?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };

function loginIdentifier(req: Req): string | null {
  const body = req.body as { identifier?: unknown } | undefined;
  const id = body?.identifier;
  return typeof id === 'string' && id.trim() ? id.trim().toLowerCase().slice(0, 120) : null;
}

const isNotLogin = (context: ExecutionContext) => loginIdentifier(context.switchToHttp().getRequest<Req>()) === null;

export const THROTTLERS: ThrottlerOptions[] = [
  // Every route: 100 requests / minute per account (or per IP when anonymous).
  { name: 'default', ttl: 60_000, limit: 100 },
  // Login only: 5 wrong guesses / minute for one account from one address…
  {
    name: 'login-account-ip',
    ttl: 60_000,
    limit: 5,
    skipIf: isNotLogin,
    getTracker: (req: Req) => `${req.ip}|${loginIdentifier(req)}`,
  },
  // …and 20 / minute for one account whatever the number of addresses (distributed guessing).
  {
    name: 'login-account',
    ttl: 60_000,
    limit: 20,
    skipIf: isNotLogin,
    getTracker: (req: Req) => `${loginIdentifier(req)}`,
  },
];

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
  ) {
    super(options, storage, reflector);
  }

  /** Signed-in → the account id (verified token only); otherwise → the IP address. */
  protected override async getTracker(req: Req): Promise<string> {
    const header = req.headers?.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (value?.startsWith('Bearer ')) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub?: string; purpose?: string }>(value.slice(7));
        if (payload.sub && !payload.purpose) return `user:${payload.sub}`;
      } catch {
        // Invalid or expired token: counted by IP like any anonymous request.
      }
    }
    return `ip:${req.ip}`;
  }

  protected override async getErrorMessage(): Promise<string> {
    return 'Trop de tentatives. Patientez une minute avant de réessayer.';
  }
}
