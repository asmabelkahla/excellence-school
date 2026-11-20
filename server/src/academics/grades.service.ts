import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { UserRole } from '../entities/user.entity';
import { ClassSubject, Grade, ReportCardEntity, SubjectComponent, SubjectRemark } from './entities';
import { SaveSheetDto } from './dto/grades.dto';

export interface Actor {
  id: string;
  role: UserRole;
}

/** Grade entry: a teacher only touches the class subjects assigned to them; the admin touches all. */
@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(ClassSubject) private readonly classSubjects: Repository<ClassSubject>,
    @InjectRepository(SubjectComponent) private readonly components: Repository<SubjectComponent>,
    @InjectRepository(Grade) private readonly grades: Repository<Grade>,
    @InjectRepository(SubjectRemark) private readonly remarks: Repository<SubjectRemark>,
    @InjectRepository(ReportCardEntity) private readonly cards: Repository<ReportCardEntity>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    private readonly dataSource: DataSource,
  ) {}

  /** Class subjects the actor can grade, grouped by class on the client. */
  async assignments(actor: Actor) {
    const list = await this.classSubjects.find({
      where: actor.role === 'admin' ? {} : { teacher_id: actor.id },
      relations: { schoolClass: true, subject: { domain: true }, teacher: true },
    });
    const componentCounts = await this.componentsBySubject(list.map(cs => cs.subject_id));
    return list
      .map(cs => ({
        id: cs.id,
        class_id: cs.class_id,
        class_name: cs.schoolClass?.name ?? cs.class_id,
        subject_id: cs.subject_id,
        subject_name: cs.subject?.name_fr ?? cs.subject_id,
        subject_name_ar: cs.subject?.name_ar ?? null,
        domain_name: cs.subject?.domain?.name_fr ?? null,
        domain_position: cs.subject?.domain?.position ?? 99,
        subject_position: cs.subject?.position ?? 99,
        coefficient: cs.coefficient,
        teacher_name: cs.teacher?.full_name ?? null,
        component_count: componentCounts.get(cs.subject_id)?.length ?? 0,
      }))
      .sort((a, b) =>
        a.class_name.localeCompare(b.class_name, 'fr') ||
        a.domain_position - b.domain_position ||
        a.subject_position - b.subject_position);
  }

  /** The grading sheet of one class subject for one trimester. */
  async sheet(classSubjectId: string, trimester: number, actor: Actor) {
    const cs = await this.requireAccess(classSubjectId, actor);
    const [components, students, grades, remarks, cards] = await Promise.all([
      this.components.find({ where: { subject_id: cs.subject_id }, order: { position: 'ASC' } }),
      this.students.find({ where: { class_id: cs.class_id }, order: { last_name: 'ASC', first_name: 'ASC' } }),
      this.grades.find({ where: { class_subject_id: cs.id, trimester } }),
      this.remarks.find({ where: { class_subject_id: cs.id, trimester } }),
      this.cards.find({ where: { class_id: cs.class_id, trimester, status: 'published' }, select: ['student_id'] }),
    ]);
    const published = new Set(cards.map(c => c.student_id));

    return {
      class_subject: {
        id: cs.id,
        class_id: cs.class_id,
        class_name: cs.schoolClass?.name ?? cs.class_id,
        subject_name: cs.subject?.name_fr ?? cs.subject_id,
        subject_name_ar: cs.subject?.name_ar ?? null,
        coefficient: cs.coefficient,
      },
      trimester,
      // A subject without components is graded as a whole, out of 20.
      components: components.length
        ? components.map(c => ({ id: c.id, name_fr: c.name_fr, name_ar: c.name_ar, max_score: c.max_score }))
        : [{ id: '', name_fr: 'Note', name_ar: 'العدد', max_score: 20 }],
      students: students.map(st => ({
        id: st.id,
        first_name: st.first_name,
        last_name: st.last_name,
        scores: Object.fromEntries(grades.filter(g => g.student_id === st.id).map(g => [g.component_id, g.score])),
        remark: remarks.find(r => r.student_id === st.id)?.remark ?? '',
        locked: published.has(st.id),
      })),
    };
  }

  async saveSheet(classSubjectId: string, dto: SaveSheetDto, actor: Actor) {
    const cs = await this.requireAccess(classSubjectId, actor);
    const components = await this.components.find({ where: { subject_id: cs.subject_id } });
    const maxByComponent = new Map<string, number>(
      components.length ? components.map(c => [c.id, c.max_score]) : [['', 20]],
    );

    const studentIds = [...new Set(dto.rows.map(r => r.studentId))];
    const inClass = await this.students.find({ where: { id: In(studentIds), class_id: cs.class_id } });
    if (inClass.length !== studentIds.length) {
      throw new BadRequestException('Un des élèves n’appartient pas à cette classe.');
    }

    // A published bulletin is frozen: its grades can no longer change.
    const locked = await this.cards.find({
      where: { student_id: In(studentIds), trimester: dto.trimester, status: 'published' },
      select: ['student_id'],
    });
    if (locked.length) {
      const names = inClass.filter(s => locked.some(l => l.student_id === s.id)).map(s => `${s.first_name} ${s.last_name}`);
      throw new ConflictException(
        `Bulletin déjà publié pour ${names.join(', ')} : retirez la publication avant de modifier les notes.`,
      );
    }

    // Validate everything before writing anything.
    for (const row of dto.rows) {
      for (const [componentId, score] of Object.entries(row.scores)) {
        const max = maxByComponent.get(componentId);
        if (max === undefined) throw new BadRequestException('Composante de note inconnue.');
        if (score === null) continue;
        if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > max) {
          throw new BadRequestException(`Note invalide (${score}) : elle doit être comprise entre 0 et ${max}.`);
        }
        if (Math.round(score * 100) !== score * 100) {
          throw new BadRequestException('Les notes ont au plus deux décimales.');
        }
      }
    }

    await this.dataSource.transaction(async manager => {
      const grades = manager.getRepository(Grade);
      const remarks = manager.getRepository(SubjectRemark);
      for (const row of dto.rows) {
        for (const [componentId, score] of Object.entries(row.scores)) {
          const key = { student_id: row.studentId, class_subject_id: cs.id, trimester: dto.trimester, component_id: componentId };
          if (score === null) {
            await grades.delete(key);
          } else {
            await grades.save({ ...key, score, max_score: maxByComponent.get(componentId)!, entered_by: actor.id, updated_at: new Date() });
          }
        }
        if (row.remark !== undefined) {
          const key = { student_id: row.studentId, class_subject_id: cs.id, trimester: dto.trimester };
          const text = row.remark.trim();
          if (text) await remarks.save({ ...key, remark: text, updated_at: new Date() });
          else await remarks.delete(key);
        }
      }
    });
    return this.sheet(cs.id, dto.trimester, actor);
  }

  private async requireAccess(classSubjectId: string, actor: Actor) {
    const cs = await this.classSubjects.findOne({
      where: { id: classSubjectId },
      relations: { schoolClass: true, subject: true },
    });
    if (!cs) throw new NotFoundException('Matière introuvable pour cette classe.');
    if (actor.role !== 'admin' && cs.teacher_id !== actor.id) {
      throw new ForbiddenException('Cette matière ne vous est pas attribuée.');
    }
    return cs;
  }

  private async componentsBySubject(subjectIds: string[]) {
    const map = new Map<string, SubjectComponent[]>();
    if (!subjectIds.length) return map;
    const list = await this.components.find({ where: { subject_id: In([...new Set(subjectIds)]) } });
    for (const c of list) map.set(c.subject_id, [...(map.get(c.subject_id) ?? []), c]);
    return map;
  }
}
