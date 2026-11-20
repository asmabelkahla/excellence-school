import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { SchoolClass } from '../entities/class.entity';
import { User } from '../entities/user.entity';

/** Postgres NUMERIC comes back as a string: expose it as a number. */
export const numeric = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? null : Number(value)),
};

@Entity('domains')
export class Domain {
  @PrimaryColumn('text') id: string;
  @Column('text') name_fr: string;
  @Column('text') name_ar: string;
  @Column('int') position: number;
}

@Entity('subjects')
export class Subject {
  @PrimaryColumn('text') id: string;
  @Column('text') domain_id: string;
  @Column('text') name_fr: string;
  @Column('text') name_ar: string;
  @Column('boolean') is_foreign_language: boolean;
  @Column('int') position: number;

  @ManyToOne(() => Domain)
  @JoinColumn({ name: 'domain_id' })
  domain: Domain;
}

@Entity('subject_components')
export class SubjectComponent {
  @PrimaryColumn('text') id: string;
  @Column('text') subject_id: string;
  @Column('text') name_fr: string;
  @Column({ type: 'text', nullable: true }) name_ar: string | null;
  @Column({ type: 'numeric', transformer: numeric }) max_score: number;
  @Column('int') position: number;
}

@Entity('class_subjects')
export class ClassSubject {
  @PrimaryColumn('text') id: string;
  @Column('text') class_id: string;
  @Column('text') subject_id: string;
  @Column({ type: 'text', nullable: true }) teacher_id: string | null;
  @Column({ type: 'numeric', transformer: numeric }) coefficient: number;

  @ManyToOne(() => SchoolClass)
  @JoinColumn({ name: 'class_id' })
  schoolClass: SchoolClass;

  @ManyToOne(() => Subject)
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'teacher_id' })
  teacher: User | null;
}

@Entity('grades')
export class Grade {
  @PrimaryColumn('text') student_id: string;
  @PrimaryColumn('text') class_subject_id: string;
  @PrimaryColumn('smallint') trimester: number;
  /** '' = the whole subject, graded on max_score. */
  @PrimaryColumn('text') component_id: string;
  @Column({ type: 'numeric', transformer: numeric }) score: number;
  @Column({ type: 'numeric', transformer: numeric }) max_score: number;
  @Column({ type: 'text', nullable: true }) entered_by: string | null;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) updated_at: Date;
}

@Entity('subject_remarks')
export class SubjectRemark {
  @PrimaryColumn('text') student_id: string;
  @PrimaryColumn('text') class_subject_id: string;
  @PrimaryColumn('smallint') trimester: number;
  @Column('text') remark: string;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) updated_at: Date;
}

@Entity('report_cards')
export class ReportCardEntity {
  @PrimaryColumn('text') id: string;
  @Column('text') student_id: string;
  @Column('text') class_id: string;
  @Column('smallint') trimester: number;
  @Column('text') status: 'draft' | 'published';
  @Column('jsonb') content: ReportCardContent;
  @Column({ type: 'numeric', nullable: true, transformer: numeric }) general_average: number | null;
  @Column({ type: 'numeric', nullable: true, transformer: numeric }) class_max_average: number | null;
  @Column({ type: 'numeric', nullable: true, transformer: numeric }) class_min_average: number | null;
  @Column({ type: 'numeric', nullable: true, transformer: numeric }) class_average: number | null;
  @Column({ type: 'int', nullable: true }) rank: number | null;
  @Column({ type: 'int', nullable: true }) class_size: number | null;
  @Column({ type: 'int', default: 0 }) missing_count: number;
  @Column({ type: 'text', nullable: true }) behavior_remarks: string | null;
  @Column({ type: 'text', nullable: true }) mention: string | null;
  @Column({ type: 'text', nullable: true }) headmaster_remarks: string | null;
  @Column({ type: 'timestamptz' }) generated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) published_at: Date | null;
}

export interface ReportCardSubjectLine {
  subject_id: string;
  name_fr: string;
  name_ar: string;
  coefficient: number;
  score_20: number | null;
  class_max: number | null;
  class_min: number | null;
  class_average: number | null;
  remark: string | null;
  teacher_name: string | null;
}

export interface ReportCardContent {
  student_first_name: string;
  student_last_name: string;
  student_first_name_ar: string | null;
  student_last_name_ar: string | null;
  class_name: string;
  school_year: string;
  class_size: number;
  domains: {
    domain_id: string;
    name_fr: string;
    name_ar: string;
    domain_average: number | null;
    subjects: ReportCardSubjectLine[];
  }[];
  languages_details: {
    subject_id: string;
    subject_name_fr: string;
    subject_name_ar: string;
    coefficient: number;
    components: { component_name_fr: string; component_name_ar: string | null; max_score: number; score: number | null }[];
    total_score: number;
    total_max: number;
    final_score_20: number | null;
    teacher_observation: string | null;
  }[];
  /** Subjects with no (or incomplete) grades: the bulletin cannot be published while non-empty. */
  missing_subjects: string[];
}

@Entity('homework')
export class Homework {
  @PrimaryColumn('text') id: string;
  @Column('text') class_subject_id: string;
  @Column('text') class_id: string;
  @Column({ type: 'text', nullable: true }) teacher_id: string | null;
  @Column('text') title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  /** YYYY-MM-DD (kept as a string: no timezone shift). */
  @Column({ type: 'date' }) due_date: string;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) created_at: Date;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) updated_at: Date;

  @ManyToOne(() => ClassSubject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_subject_id' })
  classSubject: ClassSubject;
}

@Entity('homework_done')
export class HomeworkDone {
  @PrimaryColumn('text') homework_id: string;
  @PrimaryColumn('text') student_id: string;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) done_at: Date;
}
