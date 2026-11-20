import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { AcademicsApiService, Trimester } from '../../../core/services/academics-api.service';
import { ReportCard } from '../../../core/models/academics.model';
import { BulletinViewComponent } from '../../../shared/components/bulletin-view/bulletin-view.component';
import { LanguagesSheetViewComponent } from '../../../shared/components/languages-sheet-view/languages-sheet-view.component';

interface SubjectInsight {
  name: string;
  domain: string;
  score: number;
  classAverage: number | null;
  /** score minus class average, when known. */
  gap: number | null;
  remark: string | null;
}

const TRIMESTERS: Trimester[] = [1, 2, 3];

/**
 * A parent's view of their child's published bulletins:
 * summary, details by domain, strengths and progress, then the official documents.
 * Only published bulletins of the parent's own children come back from the API.
 */
@Component({
  selector: 'app-parent-grades',
  standalone: true,
  imports: [CommonModule, RouterModule, BulletinViewComponent, LanguagesSheetViewComponent],
  templateUrl: './parent-grades.component.html',
  styleUrls: ['./parent-grades.component.scss']
})
export class ParentGradesComponent {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  private readonly academics = inject(AcademicsApiService);

  readonly trimesters = TRIMESTERS;
  readonly cards = signal<ReportCard[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedTrimester = signal<Trimester>(1);
  readonly documentTab = signal<'official' | 'languages'>('official');

  readonly card = computed(() => this.cards().find(c => c.trimester === this.selectedTrimester()) ?? null);
  readonly previousCard = computed(() => {
    const t = this.selectedTrimester();
    return [...this.cards()].reverse().find(c => c.trimester < t) ?? null;
  });

  /** Change of the general average since the previous published trimester. */
  readonly evolution = computed(() => {
    const now = this.card()?.general_average;
    const before = this.previousCard()?.general_average;
    return now != null && before != null ? Math.round((now - before) * 100) / 100 : null;
  });

  readonly subjects = computed<SubjectInsight[]>(() =>
    (this.card()?.content.domains ?? []).flatMap(d =>
      d.subjects
        .filter(s => s.score_20 !== null)
        .map(s => ({
          name: s.name_fr,
          domain: d.name_fr,
          score: s.score_20 as number,
          classAverage: s.class_average ?? null,
          gap: s.class_average != null ? Math.round(((s.score_20 as number) - s.class_average) * 100) / 100 : null,
          remark: s.remark ?? null
        }))
    )
  );

  /** Best results compared with the class (falls back to raw score). */
  readonly strengths = computed(() =>
    [...this.subjects()]
      .sort((a, b) => (b.gap ?? b.score - 10) - (a.gap ?? a.score - 10))
      .filter(s => s.score >= 12)
      .slice(0, 3));

  /** Below 10/20, or clearly under the class average. */
  readonly toWorkOn = computed(() =>
    [...this.subjects()]
      .filter(s => s.score < 10 || (s.gap !== null && s.gap <= -1.5))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3));

  readonly teacherRemarks = computed(() => this.subjects().filter(s => s.remark));

  readonly hasLanguages = computed(() => (this.card()?.content.languages_details?.length ?? 0) > 0);

  constructor() {
    // Reload whenever the selected child changes.
    effect(() => {
      const child = this.auth.selectedStudent();
      untracked(() => void this.load(child?.id ?? null));
    });
  }

  async load(studentId: string | null): Promise<void> {
    this.cards.set([]);
    this.error.set(null);
    if (!studentId) return;
    this.loading.set(true);
    try {
      const cards = await this.academics.childReportCards(studentId);
      if (this.auth.selectedStudent()?.id !== studentId) return; // child switched meanwhile
      this.cards.set(cards);
      // Open the latest published trimester.
      const latest = cards.length ? cards[cards.length - 1].trimester : 1;
      this.selectedTrimester.set(latest);
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  isPublished(t: Trimester): boolean {
    return this.cards().some(c => c.trimester === t);
  }

  averageOf(t: Trimester): number | null {
    return this.cards().find(c => c.trimester === t)?.general_average ?? null;
  }

  selectTrimester(t: Trimester): void {
    this.selectedTrimester.set(t);
    this.documentTab.set('official');
  }

  /** Bar length in % of the 0–20 scale. */
  pct(score: number | null | undefined): number {
    return score == null ? 0 : Math.max(0, Math.min(100, (score / 20) * 100));
  }

  trimesterLabel(t: Trimester): string {
    return t === 1 ? '1er trimestre' : t === 2 ? '2e trimestre' : '3e trimestre';
  }
}
