import { ReportKind, ReportStatus } from './school.model';

export interface Domain {
  id: string;
  name_fr: string;
  name_ar: string;
  position: number;
}

export interface Subject {
  id: string;
  domain_id: string;
  name_fr: string;
  name_ar: string;
  is_foreign_language: boolean;
  position: number;
  components?: SubjectComponent[];
}

export interface SubjectComponent {
  id: string;
  subject_id: string;
  name_fr: string;
  name_ar?: string;
  max_score: number; // e.g. 5, 15, 6, 14, 10, 20
  position: number;
}

export interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id?: string;
  teacher_name?: string;
  coefficient: number;
  position: number;
  subject?: Subject;
  components?: SubjectComponent[];
}

export interface Grade {
  id: string;
  student_id: string;
  class_subject_id: string;
  component_id?: string; // If component level grade
  trimester: 1 | 2 | 3;
  score: number;
  max_score: number;
  entered_by?: string;
  updated_at?: string;
}

export interface ReportCardDomainSummary {
  domain_id: string;
  name_fr: string;
  name_ar: string;
  subjects: {
    subject_id: string;
    name_fr: string;
    name_ar: string;
    coefficient: number;
    score_20: number | null;
    class_max: number | null;
    class_min: number | null;
    class_average?: number | null;
    /** Teacher's observation for this subject (API bulletins). */
    remark?: string | null;
    teacher_name?: string | null;
  }[];
  domain_average: number | null;
  /** Legacy demo data: one remark per domain. */
  recommendations?: string;
}

export interface ForeignLanguageComponentGrade {
  component_name_fr: string;
  component_name_ar?: string;
  max_score: number;
  score: number | null;
}

export interface ForeignLanguageDetail {
  subject_id: string;
  subject_name_fr: string;
  subject_name_ar?: string;
  coefficient: number;
  components: ForeignLanguageComponentGrade[];
  total_score: number;
  total_max: number;
  final_score_20: number | null;
  teacher_observation?: string | null;
}

export interface ReportCardContent {
  domains?: ReportCardDomainSummary[];
  languages_details?: ForeignLanguageDetail[];
  student_first_name?: string;
  student_last_name?: string;
  student_first_name_ar?: string | null;
  student_last_name_ar?: string | null;
  class_name?: string;
  school_year?: string;
  class_size?: number;
  headmaster_remarks?: string;
  /** Admin only: subjects still without (complete) grades. */
  missing_subjects?: string[];
}

export interface ReportCard {
  id: string;
  student_id: string;
  class_id: string;
  trimester: 1 | 2 | 3;
  /** Legacy demo data only: API bulletins hold both documents in one record. */
  kind?: ReportKind;
  status: ReportStatus; // 'draft' | 'validated' | 'published'
  content: ReportCardContent;
  general_average?: number | null;
  class_max_average?: number | null;
  class_min_average?: number | null;
  class_average?: number | null;
  rank?: number | null;
  class_size?: number | null;
  missing_count?: number;
  behavior_remarks?: string | null;
  mention?: string | null;
  headmaster_remarks?: string | null;
  generated_at?: string;
  pdf_path?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
}

