import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { ParentStudent } from '../entities/parent-student.entity';
import { Student } from '../entities/student.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassSubject, Homework, HomeworkDone } from './entities';
import { CreateHomeworkDto, UpdateHomeworkDto } from './dto/homework.dto';
import { Actor } from './grades.service';

const DAY = 24 * 3600 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** "jeudi 27/11" — short French date for notifications. */
function frenchDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][d.getUTCDay()];
  return `${day} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

@Injectable()
export class HomeworkService {
  constructor(
    @InjectRepository(Homework) private readonly homework: Repository<Homework>,
    @InjectRepository(HomeworkDone) private readonly done: Repository<HomeworkDone>,
    @InjectRepository(ClassSubject) private readonly classSubjects: Repository<ClassSubject>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(ParentStudent) private readonly links: Repository<ParentStudent>,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------- teacher

  /** The actor's homework from 30 days ago onwards, with how many children ticked it. */
  async listForTeacher(actor: Actor) {
    const since = isoDay(new Date(Date.now() - 30 * DAY));
    const where = actor.role === 'admin' ? { due_date: MoreThanOrEqual(since) } : { teacher_id: actor.id, due_date: MoreThanOrEqual(since) };
    const list = await this.homework.find({
      where,
      relations: { classSubject: { subject: true, schoolClass: true } },
      order: { due_date: 'ASC', created_at: 'ASC' },
    });
    return this.withProgress(list);
  }

  async create(dto: CreateHomeworkDto, actor: Actor) {
    const cs = await this.requireClassSubject(dto.classSubjectId, actor);
    this.assertDueDate(dto.dueDate);
    const hw = await this.homework.save({
      id: `hw-${randomUUID()}`,
      class_subject_id: cs.id,
      class_id: cs.class_id,
      teacher_id: actor.role === 'teacher' ? actor.id : cs.teacher_id,
      title: dto.title,
      description: dto.description || null,
      due_date: dto.dueDate,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await this.notifyParents(cs, hw, 'new');
    return (await this.withProgress([await this.load(hw.id)]))[0];
  }

  async update(id: string, dto: UpdateHomeworkDto, actor: Actor) {
    const hw = await this.requireOwned(id, actor);
    const dueChanged = dto.dueDate !== undefined && dto.dueDate !== hw.due_date;
    if (dueChanged) this.assertDueDate(dto.dueDate!);
    if (dto.title !== undefined) hw.title = dto.title;
    if (dto.description !== undefined) hw.description = dto.description || null;
    if (dto.dueDate !== undefined) hw.due_date = dto.dueDate;
    hw.updated_at = new Date();
    await this.homework.save(hw);
    // Parents are told again only when the due date moves (that changes their planning).
    if (dueChanged) await this.notifyParents(hw.classSubject, hw, 'moved');
    return (await this.withProgress([await this.load(id)]))[0];
  }

  async remove(id: string, actor: Actor) {
    await this.requireOwned(id, actor);
    await this.homework.delete({ id });
    return { deleted: true };
  }

  // ----------------------------------------------------------------- parent

  /** Homework of the child's class (from 14 days ago), with the child's "done" ticks. */
  async listForChild(parentId: string, studentId: string) {
    const student = await this.requireChild(parentId, studentId);
    if (!student.class_id) return [];
    const since = isoDay(new Date(Date.now() - 14 * DAY));
    const list = await this.homework.find({
      where: { class_id: student.class_id, due_date: MoreThanOrEqual(since) },
      relations: { classSubject: { subject: true, teacher: true } },
      order: { due_date: 'ASC', created_at: 'ASC' },
    });
    const ticks = list.length
      ? await this.done.find({ where: { student_id: studentId, homework_id: In(list.map(h => h.id)) } })
      : [];
    return list.map(h => ({
      id: h.id,
      title: h.title,
      description: h.description,
      due_date: h.due_date,
      subject_name: h.classSubject?.subject?.name_fr ?? '',
      subject_name_ar: h.classSubject?.subject?.name_ar ?? null,
      teacher_name: h.classSubject?.teacher?.full_name ?? null,
      created_at: h.created_at,
      done: ticks.some(t => t.homework_id === h.id),
    }));
  }

  async setDone(parentId: string, studentId: string, homeworkId: string, done: boolean) {
    const student = await this.requireChild(parentId, studentId);
    const hw = await this.homework.findOne({ where: { id: homeworkId } });
    if (!hw || hw.class_id !== student.class_id) throw new NotFoundException('Devoir introuvable.');
    if (done) await this.done.save({ homework_id: hw.id, student_id: student.id, done_at: new Date() });
    else await this.done.delete({ homework_id: hw.id, student_id: student.id });
    return { done };
  }

  // ---------------------------------------------------------------- helpers

  private async notifyParents(cs: ClassSubject, hw: Homework, reason: 'new' | 'moved') {
    const students = await this.students.find({ where: { class_id: hw.class_id } });
    if (!students.length) return;
    const links = await this.links.find({ where: { student_id: In(students.map(s => s.id)) } });
    const subject = cs.subject?.name_fr ?? 'Devoir';
    // One notification per parent and per child (a parent may have two children in the class).
    for (const st of students) {
      const parents = links.filter(l => l.student_id === st.id).map(l => l.parent_id);
      if (!parents.length) continue;
      await this.notifications.notify(parents, {
        type: 'homework',
        title: reason === 'new' ? `📚 Nouveau devoir — ${subject}` : `📅 Devoir déplacé — ${subject}`,
        body: `${st.first_name} : « ${hw.title} », pour ${frenchDay(hw.due_date)}.`,
        link: '/parent/homework',
        studentId: st.id,
      });
    }
  }

  private async withProgress(list: Homework[]) {
    if (!list.length) return [];
    const classIds = [...new Set(list.map(h => h.class_id))];
    const [sizes, ticks] = await Promise.all([
      this.students.createQueryBuilder('s').select('s.class_id', 'class_id').addSelect('COUNT(*)', 'n')
        .where('s.class_id IN (:...classIds)', { classIds }).groupBy('s.class_id').getRawMany<{ class_id: string; n: string }>(),
      this.done.createQueryBuilder('d').select('d.homework_id', 'homework_id').addSelect('COUNT(*)', 'n')
        .where('d.homework_id IN (:...ids)', { ids: list.map(h => h.id) }).groupBy('d.homework_id').getRawMany<{ homework_id: string; n: string }>(),
    ]);
    return list.map(h => ({
      id: h.id,
      class_subject_id: h.class_subject_id,
      class_id: h.class_id,
      class_name: h.classSubject?.schoolClass?.name ?? null,
      subject_name: h.classSubject?.subject?.name_fr ?? '',
      title: h.title,
      description: h.description,
      due_date: h.due_date,
      created_at: h.created_at,
      done_count: Number(ticks.find(t => t.homework_id === h.id)?.n ?? 0),
      class_size: Number(sizes.find(s => s.class_id === h.class_id)?.n ?? 0),
    }));
  }

  private async load(id: string) {
    const hw = await this.homework.findOne({ where: { id }, relations: { classSubject: { subject: true, schoolClass: true } } });
    if (!hw) throw new NotFoundException('Devoir introuvable.');
    return hw;
  }

  private async requireOwned(id: string, actor: Actor) {
    const hw = await this.load(id);
    if (actor.role !== 'admin' && hw.teacher_id !== actor.id) throw new ForbiddenException('Ce devoir ne vous appartient pas.');
    return hw;
  }

  private async requireClassSubject(id: string, actor: Actor) {
    const cs = await this.classSubjects.findOne({ where: { id }, relations: { subject: true, schoolClass: true } });
    if (!cs) throw new NotFoundException('Matière introuvable pour cette classe.');
    if (actor.role !== 'admin' && cs.teacher_id !== actor.id) throw new ForbiddenException('Cette matière ne vous est pas attribuée.');
    return cs;
  }

  private async requireChild(parentId: string, studentId: string) {
    const linked = await this.links.count({ where: { parent_id: parentId, student_id: studentId } });
    if (!linked) throw new ForbiddenException('Cet enfant n’est pas rattaché à votre compte.');
    const student = await this.students.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Élève introuvable.');
    return student;
  }

  /** From today up to one year ahead. */
  private assertDueDate(iso: string) {
    const today = isoDay(new Date());
    const max = isoDay(new Date(Date.now() + 365 * DAY));
    if (iso < today) throw new BadRequestException('La date de remise ne peut pas être dans le passé.');
    if (iso > max) throw new BadRequestException('La date de remise est trop lointaine.');
  }
}
