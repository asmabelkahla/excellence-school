import { ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AuthService } from './auth.service';
import { GoogleRegisterDto } from './dto/google.dto';

interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

/** Purpose stamped in the short-lived token that carries a verified Google profile between the two steps. */
const SIGNUP_PURPOSE = 'google-signup';

/**
 * "Continue with Google" for parents.
 * The Google ID token is verified server-side (signature, audience = our client id,
 * expiry, verified email): the browser is never trusted with the identity.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger('GoogleAuth');
  private readonly clientId: string | null;
  private readonly client: OAuth2Client | null;

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID')?.trim() || null;
    this.client = this.clientId ? new OAuth2Client(this.clientId) : null;
    if (!this.clientId) this.logger.log('GOOGLE_CLIENT_ID not set: Google sign-in is hidden.');
  }

  /** Public: the front-end shows the Google button only when this is set. */
  config() {
    return { clientId: this.clientId };
  }

  /**
   * Existing parent → signed in. Unknown Google account → a 30-minute registration token
   * so the parent can complete phone + children without the API trusting the browser.
   */
  async signIn(credential: string) {
    const profile = await this.verify(credential);

    let user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.google_sub')
      .where('u.google_sub = :sub', { sub: profile.sub })
      .getOne();
    if (!user) {
      user = await this.users
        .createQueryBuilder('u')
        .addSelect('u.google_sub')
        .where('LOWER(u.email) = LOWER(:email)', { email: profile.email })
        .getOne();
    }

    if (!user) {
      const registrationToken = await this.jwt.signAsync(
        { purpose: SIGNUP_PURPOSE, gsub: profile.sub, email: profile.email, name: profile.name },
        { expiresIn: '30m' },
      );
      return { status: 'needs_registration' as const, registrationToken, profile: { email: profile.email, fullName: profile.name } };
    }

    if (user.role !== 'parent') {
      throw new ForbiddenException('La connexion Google est réservée aux parents. Utilisez votre email et votre mot de passe.');
    }
    if (user.google_sub && user.google_sub !== profile.sub) {
      throw new ConflictException('Ce compte est déjà lié à un autre compte Google.');
    }
    if (!user.google_sub) {
      // Same verified email: link the Google account to the existing parent account.
      await this.users.update(user.id, { google_sub: profile.sub });
    }
    const session = await this.auth.sessionFor(user.id);
    return { status: 'signed_in' as const, ...session };
  }

  /** Step 2 for a new parent: creates the (inactive) account and the link requests. */
  async register(dto: GoogleRegisterDto) {
    let payload: { purpose?: string; gsub?: string; email?: string; name?: string };
    try {
      payload = await this.jwt.verifyAsync(dto.registrationToken);
    } catch {
      throw new UnauthorizedException('Session Google expirée : recommencez avec « Continuer avec Google ».');
    }
    if (payload.purpose !== SIGNUP_PURPOSE || !payload.gsub || !payload.email) {
      throw new UnauthorizedException('Jeton d’inscription invalide.');
    }

    const taken = await this.users
      .createQueryBuilder('u')
      .where('u.google_sub = :sub', { sub: payload.gsub })
      .getCount();
    if (taken) throw new ConflictException('Ce compte Google est déjà inscrit.');

    return this.auth.registerParent(
      {
        fullName: payload.name || payload.email,
        email: payload.email,
        phone: dto.phone,
        password: '',
        relationship: dto.relationship,
        children: dto.children,
      },
      { sub: payload.gsub },
    );
  }

  private async verify(credential: string): Promise<GoogleProfile> {
    if (!this.client || !this.clientId) {
      throw new ForbiddenException('La connexion Google n’est pas activée sur ce serveur.');
    }
    try {
      const ticket = await this.client.verifyIdToken({ idToken: credential, audience: this.clientId });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email) throw new Error('incomplete payload');
      if (!p.email_verified) throw new UnauthorizedException('Adresse Google non vérifiée.');
      return { sub: p.sub, email: p.email.toLowerCase(), name: p.name ?? '' };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Connexion Google refusée : jeton invalide ou expiré.');
    }
  }
}
