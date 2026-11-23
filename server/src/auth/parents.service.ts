import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hashPassword } from './passwords';
import { randomUUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { LinkRequest, ParentRelationship } from '../entities/link-request.entity';
import { ParentStudent } from '../entities/parent-student.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { assertEmailFree, generateTemporaryPassword } from './account-utils';
import { ChildLinkDto, CreateParentDto, UpdateParentDto } from './dto/parent.dto';

export type ParentStatus = 'active' | 'pending' | 'inactive';

export interface ParentView {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  must_change_password: boolean;
  created_at: Date;
  /** pending = self-registered and waiting for the admin to validate a link request. */
  status: ParentStatus;
  pending_requests: number;
  children: {
    student_id: string;
    first_name: string;
    last_name: string;
    class_name: string | null;
    relationship: string;
  }[];
}

@Injectable()
export class ParentsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ParentStudent) private readonly links: Repository<ParentStudent>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(LinkRequest) private readonly requests: Repository<LinkRequest>,
    private readonly dataSource: DataSource,
  ) {}

  async list(): Promise<ParentView[]> {
    const parents = await this.users.find({ where: { role: 'parent' }, order: { full_name: 'ASC' } });
    return this.toViews(parents);
  }

  /** Account created at the school desk: active right away, with a one-time password. */
  async create(dto: CreateParentDto, actorId: string) {
    await assertEmailFree(this.users, dto.email);
    const children = this.uniqueChildren(dto.children ?? []);
    await this.requireStudents(children.map(c => c.studentId));

    const temporaryPassword = generateTemporaryPassword();
    const id = `usr-parent-${randomUUID()}`;
    await this.dataSource.transaction(async manager => {
      await manager.getRepository(User).insert({
        id,
        role: 'parent',
        full_name: dto.fullName,
        email: dto.email,
        phone: dto.phone || null,
        password: await hashPassword(temporaryPassword),
        locale: 'fr',
        active: true,
        avatar_url: 'assets/avatars/parent.png',
        is_super_admin: false,
        invited_by_id: actorId,
        must_change_password: true,
      });
      if (children.length) {
        await manager.getRepository(ParentStudent).insert(
          children.map(c => ({ parent_id: id, student_id: c.studentId, relationship: c.relationship })),
        );
      }
    });
    return { parent: await this.getView(id), temporaryPassword };
  }

  async update(id: string, dto: UpdateParentDto) {
    const parent = await this.requireParent(id);

    if (dto.active === true && !parent.active) {
      // A self-registered parent is activated by approving their request, not from here:
      // that is where the admin checks which student they really are linked to.
      const [linked, pending] = await Promise.all([
        this.links.count({ where: { parent_id: id } }),
        this.requests.count({ where: { parent_id: id, status: 'pending' } }),
      ]);
      if (linked === 0 && pending > 0) {
        throw new BadRequestException(
          'Ce parent attend la validation de sa demande d’inscription : traitez-la depuis « Inscriptions Parents ».',
        );
      }
    }

    if (dto.email !== undefined && dto.email !== parent.email) {
      await assertEmailFree(this.users, dto.email, id);
      parent.email = dto.email;
    }
    if (dto.fullName !== undefined) parent.full_name = dto.fullName;
    if (dto.phone !== undefined) parent.phone = dto.phone || null;
    if (dto.active !== undefined) parent.active = dto.active;
    await this.users.save(parent);
    return this.getView(id);
  }

  async resetPassword(id: string) {
    await this.requireParent(id);
    const temporaryPassword = generateTemporaryPassword();
    await this.users.update(id, {
      password: await hashPassword(temporaryPassword),
      must_change_password: true,
      tokens_valid_after: new Date(),
    });
    return { temporaryPassword };
  }

  async linkChild(id: string, dto: ChildLinkDto) {
    await this.requireParent(id);
    await this.requireStudents([dto.studentId]);
    // Upsert: linking an already-linked child just updates the relationship.
    await this.links.save({ parent_id: id, student_id: dto.studentId, relationship: dto.relationship });
    return this.getView(id);
  }

  async unlinkChild(id: string, studentId: string) {
    await this.requireParent(id);
    const result = await this.links.delete({ parent_id: id, student_id: studentId });
    if (!result.affected) throw new NotFoundException('Cet enfant n’est pas rattaché à ce parent.');
    return this.getView(id);
  }

  // -------------------------------------------------------------- helpers

  private async getView(id: string): Promise<ParentView> {
    const parent = await this.requireParent(id);
    return (await this.toViews([parent]))[0];
  }

  private async toViews(parents: User[]): Promise<ParentView[]> {
    if (parents.length === 0) return [];
    const ids = parents.map(p => p.id);

    const [links, pending] = await Promise.all([
      this.links.find({ where: { parent_id: In(ids) }, relations: { student: true } }),
      this.requests
        .createQueryBuilder('r')
        .select('r.parent_id', 'parent_id')
        .addSelect('COUNT(*)', 'count')
        .where('r.parent_id IN (:...ids)', { ids })
        .andWhere("r.status = 'pending'")
        .groupBy('r.parent_id')
        .getRawMany<{ parent_id: string; count: string }>(),
    ]);
    const pendingByParent = new Map(pending.map(p => [p.parent_id, Number(p.count)]));

    return parents.map(p => {
      const pendingRequests = pendingByParent.get(p.id) ?? 0;
      const children = links
        .filter(l => l.parent_id === p.id && l.student)
        .map(l => ({
          student_id: l.student_id,
          first_name: l.student.first_name,
          last_name: l.student.last_name,
          class_name: l.student.class_name,
          relationship: normalizeRelationship(l.relationship),
        }))
        .sort((a, b) => a.first_name.localeCompare(b.first_name));
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        active: p.active,
        must_change_password: p.must_change_password,
        created_at: p.created_at,
        status: p.active ? 'active' : pendingRequests > 0 ? 'pending' : 'inactive',
        pending_requests: pendingRequests,
        children,
      };
    });
  }

  private async requireParent(id: string) {
    const parent = await this.users.findOne({ where: { id, role: 'parent' } });
    if (!parent) throw new NotFoundException('Parent introuvable.');
    return parent;
  }

  private async requireStudents(ids: string[]) {
    if (ids.length === 0) return;
    const found = await this.students.count({ where: { id: In(ids) } });
    if (found !== new Set(ids).size) throw new NotFoundException('Élève introuvable.');
  }

  private uniqueChildren(children: ChildLinkDto[]) {
    const byStudent = new Map(children.map(c => [c.studentId, c]));
    return [...byStudent.values()];
  }
}

/** Older rows used accented labels ("mère"); the API always answers with codes. */
function normalizeRelationship(value: string): ParentRelationship | string {
  const plain = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return plain === 'mere' || plain === 'pere' || plain === 'tuteur' ? plain : value;
}
