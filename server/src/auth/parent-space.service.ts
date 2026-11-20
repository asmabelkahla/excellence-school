import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { SchoolClass } from '../entities/class.entity';
import { LinkRequest } from '../entities/link-request.entity';
import { ParentStudent } from '../entities/parent-student.entity';
import { User } from '../entities/user.entity';
import { DeclareChildDto } from './dto/declare-child.dto';

const MAX_PENDING = 10;

const normalize = (value: string | null | undefined) =>
  (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** What a signed-in parent can see and do about their own children — and nothing else. */
@Injectable()
export class ParentSpaceService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ParentStudent) private readonly links: Repository<ParentStudent>,
    @InjectRepository(LinkRequest) private readonly requests: Repository<LinkRequest>,
    @InjectRepository(SchoolClass) private readonly classes: Repository<SchoolClass>,
  ) {}

  /** Only children validated by the school (parent_students), never the declared ones. */
  async children(parentId: string) {
    const links = await this.links.find({ where: { parent_id: parentId }, relations: { student: true } });
    return links
      .filter(l => l.student)
      .map(l => ({
        id: l.student.id,
        first_name: l.student.first_name,
        last_name: l.student.last_name,
        first_name_ar: l.student.first_name_ar,
        last_name_ar: l.student.last_name_ar,
        birth_date: l.student.birth_date,
        gender: l.student.gender,
        class_id: l.student.class_id,
        class_name: l.student.class_name,
        level_id: l.student.level_id,
        relationship: normalize(l.relationship),
      }))
      // Eldest first; children without a birth date go last.
      .sort((a, b) => (a.birth_date ?? '9999').localeCompare(b.birth_date ?? '9999') || a.first_name.localeCompare(b.first_name));
  }

  /** The parent's own requests. The admin's internal note is never exposed. */
  async myRequests(parentId: string) {
    const list = await this.requests.find({ where: { parent_id: parentId }, order: { created_at: 'DESC' } });
    return list.map(r => ({
      id: r.id,
      child_first_name: r.child_first_name,
      child_last_name: r.child_last_name,
      declared_class_name: r.declared_class_name,
      relationship: r.relationship,
      status: r.status,
      created_at: r.created_at,
    }));
  }

  async declareChild(parentId: string, dto: DeclareChildDto) {
    const parent = await this.users.findOne({ where: { id: parentId, role: 'parent' } });
    if (!parent) throw new NotFoundException('Compte parent introuvable.');

    const cls = dto.classId ? await this.classes.findOne({ where: { id: dto.classId } }) : null;
    if (dto.classId && !cls) throw new NotFoundException('Classe introuvable.');

    const name = normalize(`${dto.firstName} ${dto.lastName}`);
    const [pending, children] = await Promise.all([
      this.requests.find({ where: { parent_id: parentId, status: 'pending' } }),
      this.children(parentId),
    ]);
    if (children.some(c => normalize(`${c.first_name} ${c.last_name}`) === name)) {
      throw new ConflictException('Cet enfant est déjà rattaché à votre compte.');
    }
    if (pending.some(r => normalize(`${r.child_first_name} ${r.child_last_name}`) === name)) {
      throw new ConflictException('Une demande pour cet enfant est déjà en cours de traitement.');
    }
    if (pending.length >= MAX_PENDING) {
      throw new ConflictException('Trop de demandes en attente. Patientez jusqu’à leur traitement.');
    }

    const request = await this.requests.save(
      this.requests.create({
        id: `lr-${randomUUID()}`,
        parent_id: parentId,
        parent_name: parent.full_name,
        parent_phone: parent.phone,
        parent_email: parent.email,
        child_first_name: dto.firstName,
        child_last_name: dto.lastName,
        declared_class_id: cls?.id ?? null,
        declared_class_name: cls?.name ?? null,
        relationship: dto.relationship,
        student_id: null,
        status: 'pending',
        admin_note: null,
      }),
    );
    return (await this.myRequests(parentId)).find(r => r.id === request.id);
  }

  /** Class names for the "declare a child" form (no student data). */
  async classOptions() {
    const list = await this.classes.find({ select: ['id', 'name', 'level_id'], order: { level_id: 'ASC', name: 'ASC' } });
    return list.map(c => ({ id: c.id, name: c.name }));
  }
}
