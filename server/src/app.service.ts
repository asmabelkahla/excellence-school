import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { hashPassword } from './auth/passwords';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Small, idempotent schema upgrades applied at startup, so a deployed database
   * (e.g. Neon) never lags behind the code. database/schema.sql holds the same lines.
   */
  private async upgradeSchema() {
    await this.dataSource.query('ALTER TABLE link_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ');
  }

  /**
   * Creates the first super-admin only when no admin exists yet and
   * ADMIN_EMAIL / ADMIN_PASSWORD are provided. Never ships a default password.
   */
  async onModuleInit() {
    await this.upgradeSchema();
    const adminCount = await this.userRepository.count({ where: { role: 'admin' } });
    if (adminCount > 0) return;

    const email = this.config.get<string>('ADMIN_EMAIL')?.trim().toLowerCase();
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email || !password) {
      this.logger.warn('No admin account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap one.');
      return;
    }

    await this.userRepository.save({
      id: 'usr-admin-1',
      role: 'admin',
      full_name: 'Direction Excellence School',
      phone: null,
      email,
      password: await hashPassword(password),
      locale: 'fr',
      active: true,
      avatar_url: 'assets/avatars/admin.png',
      is_super_admin: true,
      invited_by_id: null,
      // ADMIN_PASSWORD sits in the hosting dashboard: it must be replaced at first sign-in.
      must_change_password: true,
    });
    this.logger.log(`Bootstrap admin created: ${email}`);
  }

  getHealth() {
    return {
      ok: true,
      name: 'excellence-school-api',
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  }
}
