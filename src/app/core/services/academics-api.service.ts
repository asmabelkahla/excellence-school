import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReportCard } from '../models/academics.model';
import { readableApiError } from './auth.service';

export type Trimester = 1 | 2 | 3;

export interface TeachingAssignment {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  subject_name_ar: string | null;
  domain_name: string | null;
  coefficient: number;
  teacher_name: string | null;
  component_count: number;
}

export interface SheetComponent {
  /** '' = the subject is graded as a whole. */
  id: string;
  name_fr: string;
  name_ar: string | null;
  max_score: number;
}

export interface SheetStudent {
  id: string;
  first_name: string;
  last_name: string;
  scores: Record<string, number>;
  remark: string;
  /** Bulletin already published for this trimester: grades are frozen. */
  locked: boolean;
}

export interface GradeSheet {
  class_subject: { id: string; class_id: string; class_name: string; subject_name: string; subject_name_ar: string | null; coefficient: number };
  trimester: Trimester;
  components: SheetComponent[];
  students: SheetStudent[];
}

export interface SheetRowInput {
  studentId: string;
  scores: Record<string, number | null>;
  remark?: string;
}

export interface ReportCardSummary {
  id: string;
  status: 'draft' | 'published';
  general_average: number | null;
  rank: number | null;
  class_size: number | null;
  missing_count: number;
  missing_subjects: string[];
  mention: string | null;
  generated_at: string;
  published_at: string | null;
}

export interface ClassReportLine {
  student_id: string;
  first_name: string;
  last_name: string;
  card: ReportCardSummary | null;
}

/** Grades and bulletins through the API (teacher entry, admin publication, parent reading). */
@Injectable({ providedIn: 'root' })
export class AcademicsApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  // ---------------------------------------------------------------- teacher
  assignments() {
    return this.call(this.http.get<TeachingAssignment[]>(`${this.api}/teaching/assignments`));
  }

  sheet(classSubjectId: string, trimester: Trimester) {
    return this.call(this.http.get<GradeSheet>(`${this.api}/teaching/class-subjects/${encodeURIComponent(classSubjectId)}/sheet`, {
      params: new HttpParams().set('trimester', trimester)
    }));
  }

  saveSheet(classSubjectId: string, trimester: Trimester, rows: SheetRowInput[]) {
    return this.call(this.http.put<GradeSheet>(`${this.api}/teaching/class-subjects/${encodeURIComponent(classSubjectId)}/sheet`, { trimester, rows }));
  }

  // ------------------------------------------------------------------ admin
  classReports(classId: string, trimester: Trimester) {
    return this.call(this.http.get<ClassReportLine[]>(`${this.api}/report-cards`, {
      params: new HttpParams().set('classId', classId).set('trimester', trimester)
    }));
  }

  generate(classId: string, trimester: Trimester) {
    return this.call(this.http.post<{ generated: number; skippedPublished: number }>(`${this.api}/report-cards/generate`, { classId, trimester }));
  }

  publishAll(classId: string, trimester: Trimester) {
    return this.call(this.http.post<{ published: number; incomplete: number }>(`${this.api}/report-cards/publish-all`, { classId, trimester }));
  }

  reportCard(id: string) {
    return this.call(this.http.get<ReportCard>(`${this.api}/report-cards/${encodeURIComponent(id)}`));
  }

  updateReportCard(id: string, changes: { behaviorRemarks?: string; mention?: string; headmasterRemarks?: string }) {
    return this.call(this.http.patch<ReportCard>(`${this.api}/report-cards/${encodeURIComponent(id)}`, changes));
  }

  publish(id: string) {
    return this.call(this.http.post<ReportCard>(`${this.api}/report-cards/${encodeURIComponent(id)}/publish`, {}));
  }

  unpublish(id: string) {
    return this.call(this.http.post<ReportCard>(`${this.api}/report-cards/${encodeURIComponent(id)}/unpublish`, {}));
  }

  // ----------------------------------------------------------------- parent
  /** Published bulletins of one of the signed-in parent's children. */
  childReportCards(studentId: string) {
    return this.call(this.http.get<ReportCard[]>(`${this.api}/me/children/${encodeURIComponent(studentId)}/report-cards`));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw new Error(readableApiError(error));
    }
  }
}
