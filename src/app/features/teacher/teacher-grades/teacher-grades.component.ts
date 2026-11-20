import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AcademicsApiService,
  GradeSheet,
  SheetRowInput,
  TeachingAssignment,
  Trimester
} from '../../../core/services/academics-api.service';

/** Editable copy of a student's row: inputs are strings so a cell can be left empty. */
interface EditableRow {
  studentId: string;
  name: string;
  locked: boolean;
  values: Record<string, string>;
  remark: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Component({
  selector: 'app-teacher-grades',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacher-grades.component.html',
  styleUrls: ['./teacher-grades.component.scss']
})
export class TeacherGradesComponent implements OnInit {
  private readonly academics = inject(AcademicsApiService);

  readonly trimesters: Trimester[] = [1, 2, 3];
  readonly assignments = signal<TeachingAssignment[]>([]);
  readonly loading = signal(true);
  readonly sheetLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal('');

  readonly classId = signal('');
  readonly classSubjectId = signal('');
  readonly trimester = signal<Trimester>(1);

  readonly sheet = signal<GradeSheet | null>(null);
  readonly rows = signal<EditableRow[]>([]);
  /** Snapshot of the rows as saved, to detect unsaved changes. */
  private saved = '';
  readonly version = signal(0); // bumped on every edit so computed values refresh

  readonly classes = computed(() => {
    const seen = new Map<string, string>();
    for (const a of this.assignments()) seen.set(a.class_id, a.class_name);
    return [...seen].map(([id, name]) => ({ id, name }));
  });

  readonly subjectsOfClass = computed(() => this.assignments().filter(a => a.class_id === this.classId()));
  readonly current = computed(() => this.assignments().find(a => a.id === this.classSubjectId()) ?? null);

  readonly dirty = computed(() => {
    this.version();
    return this.serialize() !== this.saved;
  });

  readonly invalidCount = computed(() => {
    this.version();
    return this.rows().reduce((n, r) => n + (this.sheet()?.components ?? []).filter(c => this.cellError(r, c.id, c.max_score)).length, 0);
  });

  /** Class statistics on complete rows only. */
  readonly stats = computed(() => {
    this.version();
    const scores = this.rows().map(r => this.score20(r)).filter((s): s is number => s !== null);
    const total = this.rows().length;
    if (!scores.length) return { count: 0, total, avg: null, min: null, max: null };
    return {
      count: scores.length,
      total,
      avg: round2(scores.reduce((a, b) => a + b, 0) / scores.length),
      min: Math.min(...scores),
      max: Math.max(...scores)
    };
  });

  readonly lockedCount = computed(() => this.rows().filter(r => r.locked).length);

  async ngOnInit(): Promise<void> {
    try {
      const list = await this.academics.assignments();
      this.assignments.set(list);
      if (list.length) {
        this.classId.set(list[0].class_id);
        this.classSubjectId.set(list[0].id);
        await this.loadSheet();
      }
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async changeClass(classId: string): Promise<void> {
    if (!this.confirmDiscard()) return;
    this.classId.set(classId);
    this.classSubjectId.set(this.subjectsOfClass()[0]?.id ?? '');
    await this.loadSheet();
  }

  async changeSubject(id: string): Promise<void> {
    if (!this.confirmDiscard()) return;
    this.classSubjectId.set(id);
    await this.loadSheet();
  }

  async changeTrimester(t: Trimester): Promise<void> {
    if (t === this.trimester() || !this.confirmDiscard()) return;
    this.trimester.set(t);
    await this.loadSheet();
  }

  async loadSheet(): Promise<void> {
    const id = this.classSubjectId();
    if (!id) return;
    this.sheetLoading.set(true);
    this.error.set(null);
    try {
      this.applySheet(await this.academics.sheet(id, this.trimester()));
    } catch (error) {
      this.error.set((error as Error).message);
      this.sheet.set(null);
      this.rows.set([]);
    } finally {
      this.sheetLoading.set(false);
    }
  }

  async save(): Promise<void> {
    const sheet = this.sheet();
    if (!sheet || this.saving() || this.invalidCount() > 0) return;

    const savedRows = JSON.parse(this.saved || '[]') as EditableRow[];
    const changed: SheetRowInput[] = this.rows()
      .filter(r => !r.locked)
      .filter(r => JSON.stringify(r) !== JSON.stringify(savedRows.find(s => s.studentId === r.studentId)))
      .map(r => ({
        studentId: r.studentId,
        scores: Object.fromEntries(sheet.components.map(c => [c.id, this.parse(r.values[c.id])])),
        remark: r.remark
      }));
    if (!changed.length) return;

    this.saving.set(true);
    this.error.set(null);
    try {
      this.applySheet(await this.academics.saveSheet(sheet.class_subject.id, this.trimester(), changed));
      this.flash(`Notes enregistrées pour ${changed.length} élève${changed.length > 1 ? 's' : ''}.`);
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  touch(): void {
    this.version.update(v => v + 1);
  }

  /** Score out of 20, only when every component of the row is filled and valid. */
  score20(row: EditableRow): number | null {
    const components = this.sheet()?.components ?? [];
    let total = 0;
    let max = 0;
    for (const c of components) {
      const v = this.parse(row.values[c.id]);
      if (v === null || v < 0 || v > c.max_score) return null;
      total += v;
      max += c.max_score;
    }
    return max ? round2((total / max) * 20) : null;
  }

  cellError(row: EditableRow, componentId: string, max: number): string | null {
    const raw = (row.values[componentId] ?? '').trim();
    if (!raw) return null;
    const v = this.parse(raw);
    if (v === null) return 'Nombre invalide';
    if (v < 0 || v > max) return `Entre 0 et ${max}`;
    if (Math.round(v * 100) !== v * 100) return '2 décimales max.';
    return null;
  }

  filledCount(row: EditableRow): number {
    return (this.sheet()?.components ?? []).filter(c => this.parse(row.values[c.id]) !== null).length;
  }

  private applySheet(sheet: GradeSheet): void {
    this.sheet.set(sheet);
    this.rows.set(sheet.students.map(st => ({
      studentId: st.id,
      name: `${st.last_name} ${st.first_name}`,
      locked: st.locked,
      values: Object.fromEntries(sheet.components.map(c => [c.id, st.scores[c.id] != null ? String(st.scores[c.id]) : ''])),
      remark: st.remark ?? ''
    })));
    this.saved = this.serialize();
    this.touch();
  }

  /** Accepts "12,5" as well as "12.5". */
  private parse(raw: string | undefined): number | null {
    const text = (raw ?? '').trim().replace(',', '.');
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  }

  private serialize(): string {
    return JSON.stringify(this.rows());
  }

  private confirmDiscard(): boolean {
    return !this.dirty() || window.confirm('Des notes ne sont pas enregistrées. Les abandonner ?');
  }

  private flash(message: string): void {
    this.notice.set(message);
    setTimeout(() => this.notice.set(''), 4000);
  }
}
