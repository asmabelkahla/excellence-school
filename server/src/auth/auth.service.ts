import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { SchoolClass } from '../entities/class.entity';
import { LinkRequest } from '../entities/link-request.entity';
import { ParentStudent } from '../entities/parent-student.entity';
import { StaffInvitation } from '../entities/staff-invitation.entity';
import { Student } from '../entities/student.entity';
import { StaffRole, User } from '../entities/user.entity';
import { RegisterParentDto } from './dto/register-parent.dto';
import { hashPassword, needsRehash, verifyPassword } from './passwords';
import { ReviewLinkRequestDto } from './dto/review-link-request.dto';

export type SafeUser = Omit<User, 'password' | 'tokens_valid_after' | 'google_sub'>;

const INVALID_CREDENTIALS = 'Identifiant ou mot de passe incorrect.';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(LinkRequest)
    private readonly linkRequestRepository: Repository<LinkRequest>,
    @InjectRepository(StaffInvitation)
    private readonly staffInvitationRepository: Repository<StaffInvitation>,
    @InjectRepository(SchoolClass)
    private readonly classRepository: Repository<SchoolClass>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  /** Public list for the registration form: class names only, nothing about students. */
  async publicClasses() {
    const list = await this.classRepository.find({ select: ['id', 'name', 'level_id'], order: { level_id: 'ASC', name: 'ASC' } });
    return list.map(c => ({ id: c.id, name: c.name }));
  }

  private sanitizeUser(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, tokens_valid_after, google_sub, ...safeUser } = user;
    return safeUser;
  }

  private hashPassword(password: string) {
    return hashPassword(password);
  }

  private newId(prefix: string) {
    return `${prefix}-${randomUUID()}`;
  }

  // ---------------------------------------------------------------- login

  async login(identifier: string, password: string) {
    const normalized = identifier.trim();
    const user = await this.userRepository
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:id) OR u.phone = :id', { id: normalized })
      .getOne();

    // Always run bcrypt so response time does not reveal whether the account exists.
    const passwordMatches = await verifyPassword(password, user?.password);
    if (!user || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!user.active) {
      throw new UnauthorizedException(
        user.role === 'parent'
          ? 'Votre compte est en attente de validation par l’administration.'
          : 'Ce compte a été désactivé. Contactez l’administration.',
      );
    }

    // Upgrade hashes made with an older cost (e.g. 12) to the current one, silently.
    if (user.password && needsRehash(user.password)) {
      await this.userRepository.update(user.id, { password: await hashPassword(password) });
    }

    const token = await this.signToken(user);
    return { user: this.sanitizeUser(user), token, message: 'Connexion réussie' };
  }

  /** Opens a session for an already-authenticated identity (e.g. Google), with the same checks as login. */
  async sessionFor(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS);
    if (!user.active) {
      throw new UnauthorizedException(
        user.role === 'parent'
          ? 'Votre compte est en attente de validation par l’administration.'
          : 'Ce compte a été désactivé. Contactez l’administration.',
      );
    }
    return { user: this.sanitizeUser(user), token: await this.signToken(user), message: 'Connexion réussie' };
  }

  private signToken(user: Pick<User, 'id' | 'role' | 'email'>) {
    return this.jwtService.signAsync({ sub: user.id, role: user.role, email: user.email });
  }

  /**
   * Changes the signed-in user's password, clears the "must change" flag and
   * closes every other session. Returns a fresh token for the current one.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.password || !(await verifyPassword(currentPassword, user.password))) {
      throw new BadRequestException('Le mot de passe actuel est incorrect.');
    }
    if (await verifyPassword(newPassword, user.password)) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l’actuel.');
    }

    // Whole seconds, so a token signed right after this is still accepted.
    const validAfter = new Date(Math.floor(Date.now() / 1000) * 1000);
    await this.userRepository.update(user.id, {
      password: await this.hashPassword(newPassword),
      must_change_password: false,
      tokens_valid_after: validAfter,
    });
    const updated = { ...user, must_change_password: false };
    return { user: this.sanitizeUser(updated), token: await this.signToken(updated), message: 'Mot de passe modifié.' };
  }

  // ---------------------------------------------------- parent self-signup

  /**
   * Creates an inactive parent account plus one pending link request per declared child.
   * No student record and no parent↔student link are created here: per the spec the parent
   * sees no school data until an admin approves each request (see reviewLinkRequest).
   */
  async registerParent(data: RegisterParentDto, google?: { sub: string }) {
    const email = data.email.trim().toLowerCase();
    const existing = await this.userRepository
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email })
      .getOne();

    // Never overwrite an existing account (even an inactive one): that would let anyone
    // hijack a pending registration by re-submitting it with a new password.
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email.');
    }

    // Declared classes must exist (the form only offers real ones, but the API never trusts it).
    const children = data.children ?? [];
    const classIds = [...new Set(children.map(c => c.classId).filter((id): id is string => !!id))];
    const classes = classIds.length ? await this.classRepository.find({ where: { id: In(classIds) } }) : [];
    if (classes.length !== classIds.length) {
      throw new BadRequestException('Une des classes choisies n’existe pas. Rechargez la page et réessayez.');
    }
    const classesById = new Map(classes.map(c => [c.id, c]));

    const parentId = this.newId('usr-parent');
    // A Google account has no password: it signs in through Google only.
    const passwordHash = google ? null : await this.hashPassword(data.password);

    const parentUser = await this.dataSource.transaction(async manager => {
      const user = await manager.getRepository(User).save({
        id: parentId,
        role: 'parent',
        full_name: data.fullName.trim(),
        phone: data.phone.trim(),
        email,
        password: passwordHash,
        locale: 'fr',
        active: false,
        avatar_url: 'assets/avatars/parent.png',
        is_super_admin: false,
        invited_by_id: null,
        google_sub: google?.sub ?? null,
      });

      const requests = children.map(child =>
        manager.getRepository(LinkRequest).create({
          id: this.newId('lr'),
          parent_id: parentId,
          parent_name: data.fullName.trim(),
          parent_phone: data.phone.trim(),
          parent_email: email,
          child_first_name: child.firstName.trim(),
          child_last_name: child.lastName.trim(),
          // The class name always comes from the database, never from the browser.
          declared_class_id: child.classId ? classesById.get(child.classId)!.id : null,
          declared_class_name: child.classId ? classesById.get(child.classId)!.name : null,
          student_id: null,
          status: 'pending',
          relationship: data.relationship ?? null,
          admin_note: null,
        }),
      );
      if (requests.length) await manager.getRepository(LinkRequest).save(requests);
      return user;
    });

    return {
      user: this.sanitizeUser(parentUser),
      message:
        'Votre demande d’inscription a bien été enregistrée. Elle est en attente de validation par l’administration.',
    };
  }

  // ------------------------------------------------------- link requests

  getLinkRequests() {
    return this.linkRequestRepository.find({ order: { created_at: 'DESC' } });
  }

  async reviewLinkRequest(id: string, dto: ReviewLinkRequestDto) {
    const request = await this.linkRequestRepository.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Demande introuvable.');
    if (request.status !== 'pending') {
      throw new BadRequestException('Cette demande a déjà été traitée.');
    }

    if (dto.decision === 'rejected') {
      await this.linkRequestRepository.update(id, {
        status: 'rejected',
        admin_note: dto.adminNote ?? request.admin_note,
      });
      return { ...request, status: 'rejected' };
    }

    // Either an existing student, or a new one created from what the parent declared.
    let existing: Student | null = null;
    let newClass: SchoolClass | null = null;
    if (dto.studentId) {
      existing = await this.studentRepository.findOne({ where: { id: dto.studentId } });
      if (!existing) throw new NotFoundException('Élève introuvable.');
    } else {
      const classId = dto.classId || request.declared_class_id;
      if (!classId) {
        throw new BadRequestException('Choisissez la classe de l’élève à créer, ou un élève déjà inscrit.');
      }
      newClass = await this.classRepository.findOne({ where: { id: classId } });
      if (!newClass) throw new BadRequestException('La classe choisie n’existe plus.');
    }

    const student = await this.dataSource.transaction(async manager => {
      const student = existing ?? (await manager.getRepository(Student).save({
        id: this.newId('std'),
        first_name: request.child_first_name.trim(),
        last_name: request.child_last_name.trim(),
        first_name_ar: null,
        last_name_ar: null,
        birth_date: null,
        gender: null,
        class_id: newClass!.id,
        class_name: newClass!.name,
        level_id: newClass!.level_id,
      }));
      await manager.getRepository(ParentStudent).save({
        parent_id: request.parent_id,
        student_id: student.id,
        relationship: request.relationship ?? 'tuteur',
      });
      await manager.getRepository(LinkRequest).update(id, {
        status: 'approved',
        student_id: student.id,
        admin_note: dto.adminNote ?? request.admin_note,
      });
      // The parent account becomes usable once at least one child is validated.
      await manager.getRepository(User).update(request.parent_id, { active: true });
      return student;
    });

    return { ...request, status: 'approved', student_id: student.id, student_created: !existing, student };
  }

  // ------------------------------------------- registrations without a child

  /** Self-registered parents still waiting, who declared no child (nothing to match). */
  private pendingAccountsQuery() {
    return this.userRepository
      .createQueryBuilder('u')
      .where("u.role = 'parent'")
      .andWhere('u.active = false')
      .andWhere('u.invited_by_id IS NULL')
      .andWhere('NOT EXISTS (SELECT 1 FROM link_requests r WHERE r.parent_id = u.id)')
      .andWhere('NOT EXISTS (SELECT 1 FROM parent_students ps WHERE ps.parent_id = u.id)');
  }

  async listPendingAccounts() {
    const users = await this.pendingAccountsQuery().orderBy('u.created_at', 'DESC').getMany();
    return users.map(u => ({ id: u.id, full_name: u.full_name, email: u.email, phone: u.phone, created_at: u.created_at }));
  }

  private async requirePendingAccount(id: string) {
    const user = await this.pendingAccountsQuery().andWhere('u.id = :id', { id }).getOne();
    if (!user) throw new NotFoundException('Inscription introuvable ou déjà traitée.');
    return user;
  }

  /** Opens the account; the parent then declares their children from their space. */
  async activatePendingAccount(id: string) {
    const user = await this.requirePendingAccount(id);
    await this.userRepository.update(user.id, { active: true });
    return { id: user.id, active: true };
  }

  /** Refuses the registration: the account never had any data, so it is removed. */
  async rejectPendingAccount(id: string) {
    const user = await this.requirePendingAccount(id);
    await this.userRepository.delete({ id: user.id });
    return { id: user.id, deleted: true };
  }

  // ---------------------------------------------------------------- staff

  async inviteStaff(data: {
    fullName: string;
    email: string;
    phone?: string;
    role: StaffRole;
    invitedById: string;
  }) {
    const email = data.email.trim().toLowerCase();
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Un compte avec cet email existe déjà.');
    }

    const invitation = this.staffInvitationRepository.create({
      id: this.newId('inv'),
      email,
      full_name: data.fullName.trim(),
      phone: data.phone || null,
      role: data.role,
      invited_by_id: data.invitedById,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return this.staffInvitationRepository.save(invitation);
  }

  // ---------------------------------------------------------------- users

  async getUsers(): Promise<SafeUser[]> {
    const users = await this.userRepository.find({ order: { full_name: 'ASC' } });
    return users.map(user => this.sanitizeUser(user));
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    return this.sanitizeUser(user);
  }
}
