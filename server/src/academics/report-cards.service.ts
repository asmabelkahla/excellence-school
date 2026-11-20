import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { SchoolClass } from '../entities/class.entity';
import { ParentStudent } from '../entities/parent-student.entity';
import { Student } from '../entities/student.entity';
import {
  ClassSubject,
  Domain,
  Grade,
  ReportCardContent,
  ReportCardEntity,
  ReportCardSubjectLine,
  SubjectComponent,
  SubjectRemark,
} from './entities';
import { UpdateReportCardDto } from './dto/report-cards.dto';
import { NotificationsService } from '../notifications/notifications.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Weighted mean of (value, weight) pairs, ignoring missing values. */
function weightedMean(pairs: { value: number | null; weight: number }[]): number | null {
  const valid = pairs.filter((p): p is { value: number; weight: number } => p.value !== null);
  const total = valid.reduce((s, p) => s + p.weight, 0);
  return total > 0 ? round2(valid.reduce((s, p) => s + p.value * p.weight, 0) / total) : null;
}

/** Suggested distinction, following the usual thresholds of Tunisian primary schools. */
export function suggestedMention(average: number | null): string | null {
  if (average === null) return null;
  if (average >= 17) return 'Félicitations du conseil';
  if (average >= 15) return 'Tableau d’honneur';
  if (average >= 13) return 'Encouragements';
  return null;
}

@Injectable()
export class ReportCardsService {
  constructor(
    @InjectRepository(ReportCardEntity) private readonly cards: Repository<ReportCardEntity>,
    @InjectRepository(ClassSubject) private readonly classSubjects: Repository<ClassSubject>,
    @InjectRepository(SubjectComponent) private readonly components: Repository<SubjectComponent>,
    @InjectRepository(Grade) private readonly grades: Repository<Grade>,
    @InjectRepository(SubjectRemark) private readonly remarks: Repository<SubjectRemark>,
    @InjectRepository(Domain) private readonly domains: Repository<Domain>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(SchoolClass) private readonly classes: Repository<SchoolClass>,
    @InjectRepository(ParentStudent) private readonly links: Repository<ParentStudent>,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------------ admin

  /** One line per student of the class, with the state of their bulletin. */
  async listForClass(classId: string, trimester: number) {
    await this.requireClass(classId);
    const [students, cards] = await Promise.all([
      this.students.find({ where: { class_id: classId }, order: { last_name: 'ASC', first_name: 'ASC' } }),
      this.cards.find({ where: { class_id: classId, trimester } }),
    ]);
    return students.map(st => {
      const card = cards.find(c => c.student_id === st.id);
      return {
        student_id: st.id,
        first_name: st.first_name,
        last_name: st.last_name,
        card: card ? this.summary(card) : null,
      };
    });
  }

  /**
   * (Re)computes the draft bulletins of a whole class from its grades.
   * Published bulletins are never touched; remarks typed by the admin are kept.
   */
  async generate(classId: string, trimester: number) {
    const cls = await this.requireClass(classId);
    const [students, classSubjects, domains] = await Promise.all([
      this.students.find({ where: { class_id: classId } }),
      this.classSubjects.find({ where: { class_id: classId }, relations: { subject: true, teacher: true } }),
      this.domains.find({ order: { position: 'ASC' } }),
    ]);
    if (!students.length) throw new BadRequestException('Cette classe ne contient aucun élève.');
    if (!classSubjects.length) throw new BadRequestException('Aucune matière n’est configurée pour cette classe.');

    const csIds = classSubjects.map(cs => cs.id);
    const [components, grades, remarks, existing] = await Promise.all([
      this.components.find({ where: { subject_id: In(classSubjects.map(cs => cs.subject_id)) }, order: { position: 'ASC' } }),
      this.grades.find({ where: { class_subject_id: In(csIds), trimester } }),
      this.remarks.find({ where: { class_subject_id: In(csIds), trimester } }),
      this.cards.find({ where: { class_id: classId, trimester } }),
    ]);

    const componentsOf = (subjectId: string) => components.filter(c => c.subject_id === subjectId);

    // score /20 per student per class subject (null = missing or incomplete).
    const scoreOf = new Map<string, number | null>();
    const key = (studentId: string, csId: string) => `${studentId}|${csId}`;
    for (const st of students) {
      for (const cs of classSubjects) {
        const own = grades.filter(g => g.student_id === st.id && g.class_subject_id === cs.id);
        const comps = componentsOf(cs.subject_id);
        let score: number | null = null;
        if (comps.length) {
          const complete = comps.every(c => own.some(g => g.component_id === c.id));
          if (complete) {
            const total = comps.reduce((s, c) => s + own.find(g => g.component_id === c.id)!.score, 0);
            const max = comps.reduce((s, c) => s + c.max_score, 0);
            score = round2((total / max) * 20);
          }
        } else {
          const g = own.find(x => x.component_id === '');
          if (g) score = round2((g.score / g.max_score) * 20);
        }
        scoreOf.set(key(st.id, cs.id), score);
      }
    }

    // Class statistics per subject.
    const statsOf = new Map<string, { max: number | null; min: number | null; avg: number | null }>();
    for (const cs of classSubjects) {
      const values = students.map(st => scoreOf.get(key(st.id, cs.id))).filter((v): v is number => v !== null && v !== undefined);
      statsOf.set(cs.id, values.length
        ? { max: Math.max(...values), min: Math.min(...values), avg: round2(values.reduce((a, b) => a + b, 0) / values.length) }
        : { max: null, min: null, avg: null });
    }

    // General average per student, then class statistics and rank.
    const averageOf = new Map<string, number | null>();
    for (const st of students) {
      averageOf.set(st.id, weightedMean(classSubjects.map(cs => ({ value: scoreOf.get(key(st.id, cs.id)) ?? null, weight: cs.coefficient }))));
    }
    const averages = [...averageOf.values()].filter((v): v is number => v !== null);
    const classMax = averages.length ? Math.max(...averages) : null;
    const classMin = averages.length ? Math.min(...averages) : null;
    const classAvg = averages.length ? round2(averages.reduce((a, b) => a + b, 0) / averages.length) : null;
    const rankOf = (avg: number | null) => (avg === null ? null : averages.filter(a => a > avg).length + 1);

    const schoolYear = this.config.get<string>('CURRENT_SCHOOL_YEAR_LABEL', '2026-2027');
    let generated = 0;
    let skippedPublished = 0;

    for (const st of students) {
      const previous = existing.find(c => c.student_id === st.id);
      if (previous?.status === 'published') {
        skippedPublished++;
        continue;
      }

      const line = (cs: ClassSubject): ReportCardSubjectLine => {
        const stats = statsOf.get(cs.id)!;
        return {
          subject_id: cs.subject_id,
          name_fr: cs.subject?.name_fr ?? cs.subject_id,
          name_ar: cs.subject?.name_ar ?? '',
          coefficient: cs.coefficient,
          score_20: scoreOf.get(key(st.id, cs.id)) ?? null,
          class_max: stats.max,
          class_min: stats.min,
          class_average: stats.avg,
          remark: remarks.find(r => r.student_id === st.id && r.class_subject_id === cs.id)?.remark ?? null,
          teacher_name: cs.teacher?.full_name ?? null,
        };
      };

      const domainBlocks = domains
        .map(d => {
          const inDomain = classSubjects
            .filter(cs => cs.subject?.domain_id === d.id)
            .sort((a, b) => (a.subject?.position ?? 0) - (b.subject?.position ?? 0));
          const subjects = inDomain.map(line);
          return {
            domain_id: d.id,
            name_fr: d.name_fr,
            name_ar: d.name_ar,
            domain_average: weightedMean(subjects.map(s => ({ value: s.score_20, weight: s.coefficient }))),
            subjects,
          };
        })
        .filter(d => d.subjects.length > 0);

      const languages = classSubjects
        .filter(cs => cs.subject?.is_foreign_language && componentsOf(cs.subject_id).length)
        .sort((a, b) => (a.subject?.position ?? 0) - (b.subject?.position ?? 0))
        .map(cs => {
          const comps = componentsOf(cs.subject_id).map(c => ({
            component_name_fr: c.name_fr,
            component_name_ar: c.name_ar,
            max_score: c.max_score,
            score: grades.find(g => g.student_id === st.id && g.class_subject_id === cs.id && g.component_id === c.id)?.score ?? null,
          }));
          return {
            subject_id: cs.subject_id,
            subject_name_fr: cs.subject?.name_fr ?? cs.subject_id,
            subject_name_ar: cs.subject?.name_ar ?? '',
            coefficient: cs.coefficient,
            components: comps,
            total_score: round2(comps.reduce((s, c) => s + (c.score ?? 0), 0)),
            total_max: comps.reduce((s, c) => s + c.max_score, 0),
            final_score_20: scoreOf.get(key(st.id, cs.id)) ?? null,
            teacher_observation: remarks.find(r => r.student_id === st.id && r.class_subject_id === cs.id)?.remark ?? null,
          };
        });

      const missing = classSubjects
        .filter(cs => scoreOf.get(key(st.id, cs.id)) === null)
        .map(cs => cs.subject?.name_fr ?? cs.subject_id);

      const content: ReportCardContent = {
        student_first_name: st.first_name,
        student_last_name: st.last_name,
        student_first_name_ar: st.first_name_ar,
        student_last_name_ar: st.last_name_ar,
        class_name: cls.name,
        school_year: schoolYear,
        class_size: students.length,
        domains: domainBlocks,
        languages_details: languages,
        missing_subjects: missing,
      };
      const average = averageOf.get(st.id) ?? null;

      await this.cards.save({
        id: previous?.id ?? `rc-${randomUUID()}`,
        student_id: st.id,
        class_id: classId,
        trimester,
        status: 'draft',
        content,
        general_average: average,
        class_max_average: classMax,
        class_min_average: classMin,
        class_average: classAvg,
        rank: rankOf(average),
        class_size: students.length,
        missing_count: missing.length,
        behavior_remarks: previous?.behavior_remarks ?? null,
        // Keep a mention chosen by the admin; otherwise suggest one.
        mention: previous?.mention ?? suggestedMention(average),
        headmaster_remarks: previous?.headmaster_remarks ?? null,
        generated_at: new Date(),
        published_at: null,
      });
      generated++;
    }
    return { generated, skippedPublished };
  }

  async get(id: string) {
    return this.full(await this.requireCard(id));
  }

  async update(id: string, dto: UpdateReportCardDto) {
    const card = await this.requireCard(id);
    if (card.status === 'published') {
      throw new ConflictException('Ce bulletin est publié : retirez la publication pour le modifier.');
    }
    if (dto.behaviorRemarks !== undefined) card.behavior_remarks = dto.behaviorRemarks || null;
    if (dto.mention !== undefined) card.mention = dto.mention || null;
    if (dto.headmasterRemarks !== undefined) card.headmaster_remarks = dto.headmasterRemarks || null;
    return this.full(await this.cards.save(card));
  }

  async publish(id: string) {
    const card = await this.requireCard(id);
    if (card.status === 'published') return this.full(card);
    if (card.missing_count > 0) {
      throw new BadRequestException(
        `Notes manquantes (${card.content.missing_subjects.join(', ')}) : complétez-les puis régénérez le bulletin.`,
      );
    }
    card.status = 'published';
    card.published_at = new Date();
    const saved = await this.cards.save(card);
    await this.notifyPublished([saved]);
    return this.full(saved);
  }

  /** Publishes every complete draft of the class; incomplete ones are reported, not published. */
  async publishAll(classId: string, trimester: number) {
    const drafts = await this.cards.find({ where: { class_id: classId, trimester, status: 'draft' } });
    const complete = drafts.filter(c => c.missing_count === 0);
    const now = new Date();
    for (const c of complete) {
      c.status = 'published';
      c.published_at = now;
    }
    await this.cards.save(complete);
    await this.notifyPublished(complete);
    return { published: complete.length, incomplete: drafts.length - complete.length };
  }

  async unpublish(id: string) {
    const card = await this.requireCard(id);
    card.status = 'draft';
    card.published_at = null;
    return this.full(await this.cards.save(card));
  }

  // ----------------------------------------------------------------- parent

  /** Published bulletins of one of the parent's own children, oldest trimester first. */
  async forParent(parentId: string, studentId: string) {
    const linked = await this.links.count({ where: { parent_id: parentId, student_id: studentId } });
    if (!linked) throw new ForbiddenException('Cet enfant n’est pas rattaché à votre compte.');
    const cards = await this.cards.find({
      where: { student_id: studentId, status: 'published' },
      order: { trimester: 'ASC' },
    });
    // The internal "missing subjects" list is an admin concern.
    return cards.map(c => {
      const full = this.full(c);
      return { ...full, content: { ...full.content, missing_subjects: [] } };
    });
  }

  private async notifyPublished(cards: ReportCardEntity[]) {
    if (!cards.length) return;
    const links = await this.links.find({ where: { student_id: In(cards.map(c => c.student_id)) } });
    for (const card of cards) {
      const parents = links.filter(l => l.student_id === card.student_id).map(l => l.parent_id);
      const t = card.trimester === 1 ? '1er' : `${card.trimester}e`;
      await this.notifications.notify(parents, {
        type: 'report_card',
        title: `📑 Bulletin du ${t} trimestre disponible`,
        body: `Le bulletin de ${card.content.student_first_name} est publié.`,
        link: '/parent/grades',
        studentId: card.student_id,
      });
    }
  }

  // ---------------------------------------------------------------- helpers

  private summary(card: ReportCardEntity) {
    return {
      id: card.id,
      status: card.status,
      general_average: card.general_average,
      rank: card.rank,
      class_size: card.class_size,
      missing_count: card.missing_count,
      missing_subjects: card.content?.missing_subjects ?? [],
      mention: card.mention,
      generated_at: card.generated_at,
      published_at: card.published_at,
    };
  }

  private full(card: ReportCardEntity) {
    return {
      id: card.id,
      student_id: card.student_id,
      class_id: card.class_id,
      trimester: card.trimester,
      status: card.status,
      content: card.content,
      general_average: card.general_average,
      class_max_average: card.class_max_average,
      class_min_average: card.class_min_average,
      class_average: card.class_average,
      rank: card.rank,
      class_size: card.class_size,
      missing_count: card.missing_count,
      behavior_remarks: card.behavior_remarks,
      mention: card.mention,
      headmaster_remarks: card.headmaster_remarks,
      generated_at: card.generated_at,
      published_at: card.published_at,
    };
  }

  private async requireCard(id: string) {
    const card = await this.cards.findOne({ where: { id } });
    if (!card) throw new NotFoundException('Bulletin introuvable.');
    return card;
  }

  private async requireClass(id: string) {
    const cls = await this.classes.findOne({ where: { id } });
    if (!cls) throw new NotFoundException('Classe introuvable.');
    return cls;
  }
}
