import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hashPassword } from './passwords';
import { randomUUID } from 'crypto';
import { In, Not, Repository } from 'typeorm';
import { STAFF_ROLES, User } from '../entities/user.entity';
import { assertEmailFree, generateTemporaryPassword } from './account-utils';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';

export type StaffMember = Omit<User, 'password' | 'tokens_valid_after'>;

@Injectable()
export class StaffService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async list(): Promise<StaffMember[]> {
    const staff = await this.users.find({
      where: { role: In([...STAFF_ROLES]) },
      order: { full_name: 'ASC' },
    });
    return staff.map(u => this.sanitize(u));
  }

  /** Creates an active staff account with a one-time password the user must change. */
  async create(dto: CreateStaffDto, actorId: string) {
    await assertEmailFree(this.users, dto.email);
    const temporaryPassword = generateTemporaryPassword();
    const user = await this.users.save(
      this.users.create({
        id: `usr-${dto.role}-${randomUUID()}`,
        role: dto.role,
        full_name: dto.fullName,
        email: dto.email,
        phone: dto.phone || null,
        password: await hashPassword(temporaryPassword),
        locale: 'fr',
        active: true,
        avatar_url: 'assets/avatars/default.png',
        is_super_admin: false,
        invited_by_id: actorId,
        must_change_password: true,
      }),
    );
    return { user: this.sanitize(user), temporaryPassword };
  }

  async update(id: string, dto: UpdateStaffDto, actor: { id: string }) {
    const target = await this.requireStaff(id);
    const actorUser = await this.users.findOne({ where: { id: actor.id } });
    this.assertCanManage(target, actorUser);

    const isSelf = target.id === actor.id;
    if (isSelf && dto.role !== undefined && dto.role !== target.role) {
      throw new BadRequestException('Vous ne pouvez pas modifier votre propre rôle.');
    }
    if (isSelf && dto.active === false) {
      throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte.');
    }

    const losesAdmin =
      target.role === 'admin' && target.active &&
      ((dto.role !== undefined && dto.role !== 'admin') || dto.active === false);
    if (losesAdmin) {
      const otherAdmins = await this.users.count({ where: { role: 'admin', active: true, id: Not(target.id) } });
      if (otherAdmins === 0) {
        throw new BadRequestException('Impossible : ce compte est le dernier administrateur actif.');
      }
    }

    if (dto.email !== undefined && dto.email !== target.email) {
      await assertEmailFree(this.users, dto.email, target.id);
      target.email = dto.email;
    }
    if (dto.fullName !== undefined) target.full_name = dto.fullName;
    if (dto.phone !== undefined) target.phone = dto.phone || null;
    if (dto.role !== undefined) target.role = dto.role;
    if (dto.active !== undefined) target.active = dto.active;

    return this.sanitize(await this.users.save(target));
  }

  /** New one-time password; every session of that user is closed. */
  async resetPassword(id: string, actor: { id: string }) {
    const target = await this.requireStaff(id);
    const actorUser = await this.users.findOne({ where: { id: actor.id } });
    this.assertCanManage(target, actorUser);
    if (target.id === actor.id) {
      throw new BadRequestException('Utilisez « Changer mon mot de passe » pour votre propre compte.');
    }

    const temporaryPassword = generateTemporaryPassword();
    await this.users.update(target.id, {
      password: await hashPassword(temporaryPassword),
      must_change_password: true,
      tokens_valid_after: new Date(),
    });
    return { temporaryPassword };
  }

  // -------------------------------------------------------------- helpers

  private async requireStaff(id: string) {
    const user = await this.users.findOne({ where: { id, role: In([...STAFF_ROLES]) } });
    if (!user) throw new NotFoundException('Membre du personnel introuvable.');
    return user;
  }

  /** Only a super-admin may touch a super-admin account (other than their own profile). */
  private assertCanManage(target: User, actor: User | null) {
    if (target.is_super_admin && target.id !== actor?.id && !actor?.is_super_admin) {
      throw new ForbiddenException('Seul un super-administrateur peut modifier ce compte.');
    }
  }

  private sanitize(user: User): StaffMember {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, tokens_valid_after, ...safe } = user;
    return safe;
  }
}
