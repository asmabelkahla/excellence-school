import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportCard } from '../../../core/models/academics.model';
import { AcademicsApiService, ClassReportLine, Trimester } from '../../../core/services/academics-api.service';
import { SchoolApiService } from '../../../core/services/school-api.service';
import { BulletinViewComponent } from '../../../shared/components/bulletin-view/bulletin-view.component';
import { LanguagesSheetViewComponent } from '../../../shared/components/languages-sheet-view/languages-sheet-view.component';

export const MENTIONS = ['Félicitations du conseil', 'Tableau d’honneur', 'Encouragements', 'Avertissement travail'];

@Component({
  selector: 'app-bulletins-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, BulletinViewComponent, LanguagesSheetViewComponent],
  templateUrl: './bulletins-admin.component.html',
  styleUrls: ['./bulletins-admin.component.scss']
})
export class BulletinsAdminComponent implements OnInit {
  private readonly academics = inject(AcademicsApiService);
  readonly school = inject(SchoolApiService);

  readonly trimesters: Trimester[] = [1, 2, 3];
  readonly mentions = MENTIONS;

  readonly classId = signal('');
  readonly trimester = signal<Trimester>(1);
  readonly lines = signal<ClassReportLine[]>([]);
  readonly loading = signal(false);
  readonly busy = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal('');

  readonly selected = signal<ReportCard | null>(null);
  readonly docTab = signal<'official' | 'languages'>('official');
  form = { behaviorRemarks: '', mention: '', headmasterRemarks: '' };

  readonly counts = computed(() => {
    const lines = this.lines();
    return {
      total: lines.length,
      none: lines.filter(l => !l.card).length,
      incomplete: lines.filter(l => l.card?.status === 'draft' && l.card.missing_count > 0).length,
      ready: lines.filter(l => l.card?.status === 'draft' && l.card.missing_count === 0).length,
      published: lines.filter(l => l.card?.status === 'published').length
    };
  });

  readonly selectedLine = computed(() => this.lines().find(l => l.card?.id === this.selected()?.id) ?? null);

  async ngOnInit(): Promise<void> {
    if (!this.school.loaded()) await this.school.load();
    const first = this.school.classes()[0];
    if (first) {
      this.classId.set(first.id);
      await this.refresh();
    }
  }

  async setClass(id: string): Promise<void> {
    this.classId.set(id);
    this.selected.set(null);
    await this.refresh();
  }

  async setTrimester(t: Trimester): Promise<void> {
    this.trimester.set(t);
    this.selected.set(null);
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.classId()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      this.lines.set(await this.academics.classReports(this.classId(), this.trimester()));
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async generate(): Promise<void> {
    await this.run('generate', async () => {
      const r = await this.academics.generate(this.classId(), this.trimester());
      await this.refresh();
      if (this.selected()) await this.open(this.selected()!.id);
      this.flash(`${r.generated} bulletin(s) calculé(s) à partir des notes${r.skippedPublished ? ` — ${r.skippedPublished} déjà publié(s), non modifié(s)` : ''}.`);
    });
  }

  async publishAll(): Promise<void> {
    const ready = this.counts().ready;
    if (!ready || !window.confirm(`Publier ${ready} bulletin(s) complet(s) ? Les parents pourront les consulter immédiatement.`)) return;
    await this.run('publish-all', async () => {
      const r = await this.academics.publishAll(this.classId(), this.trimester());
      await this.refresh();
      this.flash(`${r.published} bulletin(s) publié(s)${r.incomplete ? ` — ${r.incomplete} incomplet(s) laissé(s) en brouillon` : ''}.`);
    });
  }

  async open(id: string): Promise<void> {
    await this.run(`open-${id}`, async () => {
      const card = await this.academics.reportCard(id);
      this.selected.set(card);
      this.docTab.set('official');
      this.form = {
        behaviorRemarks: card.behavior_remarks ?? '',
        mention: card.mention ?? '',
        headmasterRemarks: card.headmaster_remarks ?? ''
      };
    });
  }

  async saveRemarks(): Promise<void> {
    const card = this.selected();
    if (!card) return;
    await this.run('save', async () => {
      this.selected.set(await this.academics.updateReportCard(card.id, { ...this.form }));
      await this.refresh();
      this.flash('Appréciations enregistrées.');
    });
  }

  async publish(): Promise<void> {
    const card = this.selected();
    if (!card) return;
    await this.run('publish', async () => {
      // Save pending remarks first so the published document contains them.
      await this.academics.updateReportCard(card.id, { ...this.form });
      this.selected.set(await this.academics.publish(card.id));
      await this.refresh();
      this.flash(`Bulletin de ${card.content.student_first_name} publié : visible par les parents.`);
    });
  }

  async unpublish(): Promise<void> {
    const card = this.selected();
    if (!card || !window.confirm('Retirer la publication ? Le bulletin ne sera plus visible par les parents et les notes pourront de nouveau être modifiées.')) return;
    await this.run('unpublish', async () => {
      this.selected.set(await this.academics.unpublish(card.id));
      await this.refresh();
      this.flash('Publication retirée : le bulletin est repassé en brouillon.');
    });
  }

  private async run(key: string, action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(key);
    this.error.set(null);
    try {
      await action();
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.busy.set(null);
    }
  }

  private flash(message: string): void {
    this.notice.set(message);
    setTimeout(() => this.notice.set(''), 5000);
  }
}
