import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AcademicsApiService, TeachingAssignment } from '../../../core/services/academics-api.service';
import { HomeworkApiService, TeacherHomework, daysUntil, todayIso } from '../../../core/services/homework-api.service';

function isoPlus(days: number): string {
  const d = new Date(`${todayIso()}T12:00:00`);
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Next given weekday (1 = Monday), never today. */
function nextWeekday(day: number): string {
  const today = new Date(`${todayIso()}T12:00:00`).getDay();
  const diff = ((day - today + 7) % 7) || 7;
  return isoPlus(diff);
}

@Component({
  selector: 'app-teacher-homework',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacher-homework.component.html',
  styleUrls: ['./teacher-homework.component.scss']
})
export class TeacherHomeworkComponent implements OnInit {
  private readonly academics = inject(AcademicsApiService);
  private readonly homework = inject(HomeworkApiService);

  readonly assignments = signal<TeachingAssignment[]>([]);
  readonly list = signal<TeacherHomework[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal('');
  readonly editingId = signal<string | null>(null);

  readonly minDate = todayIso();
  readonly quickDates = [
    { label: 'Demain', value: isoPlus(1) },
    { label: 'Dans 2 jours', value: isoPlus(2) },
    { label: 'Lundi', value: nextWeekday(1) },
    { label: 'Dans 1 semaine', value: isoPlus(7) }
  ];

  form = this.emptyForm();

  readonly classes = computed(() => {
    const map = new Map<string, string>();
    for (const a of this.assignments()) map.set(a.class_id, a.class_name);
    return [...map].map(([id, name]) => ({ id, name }));
  });
  classId = '';

  readonly upcoming = computed(() => this.list().filter(h => daysUntil(h.due_date) >= 0));
  readonly past = computed(() => this.list().filter(h => daysUntil(h.due_date) < 0).reverse());

  async ngOnInit(): Promise<void> {
    try {
      const [assignments, list] = await Promise.all([this.academics.assignments(), this.homework.teacherList()]);
      this.assignments.set(assignments);
      this.list.set(list);
      this.classId = assignments[0]?.class_id ?? '';
      this.form.classSubjectId = this.subjectsOfClass()[0]?.id ?? '';
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  subjectsOfClass(): TeachingAssignment[] {
    return this.assignments().filter(a => a.class_id === this.classId);
  }

  onClassChange(): void {
    this.form.classSubjectId = this.subjectsOfClass()[0]?.id ?? '';
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    const f = this.form;
    if (!f.classSubjectId || !f.title.trim() || !f.dueDate) {
      this.error.set('Choisissez la matière, un titre et la date de remise.');
      return;
    }
    if (f.dueDate < this.minDate) {
      this.error.set('La date de remise ne peut pas être dans le passé.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const id = this.editingId();
      if (id) {
        const updated = await this.homework.update(id, { title: f.title, description: f.description, dueDate: f.dueDate });
        this.list.update(l => this.sort(l.map(h => (h.id === id ? updated : h))));
        this.flash('Devoir modifié.' + (updated.due_date !== this.editedDue ? ' Les parents ont été prévenus du changement de date.' : ''));
      } else {
        const created = await this.homework.create(f);
        this.list.update(l => this.sort([...l, created]));
        this.flash(`Devoir publié : les parents des ${created.class_size} élèves de ${created.class_name} sont notifiés.`);
      }
      this.cancelEdit();
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  private editedDue = '';

  edit(h: TeacherHomework): void {
    this.editingId.set(h.id);
    this.editedDue = h.due_date;
    this.classId = h.class_id;
    this.form = { classSubjectId: h.class_subject_id, title: h.title, description: h.description ?? '', dueDate: h.due_date };
    this.error.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    const keep = this.form.classSubjectId;
    this.form = { ...this.emptyForm(), classSubjectId: keep };
  }

  async remove(h: TeacherHomework): Promise<void> {
    if (!window.confirm(`Supprimer le devoir « ${h.title} » ? Il disparaîtra aussi chez les parents.`)) return;
    try {
      await this.homework.remove(h.id);
      this.list.update(l => l.filter(x => x.id !== h.id));
      if (this.editingId() === h.id) this.cancelEdit();
      this.flash('Devoir supprimé.');
    } catch (error) {
      this.error.set((error as Error).message);
    }
  }

  dueLabel(iso: string): string {
    const d = daysUntil(iso);
    if (d === 0) return 'Pour aujourd’hui';
    if (d === 1) return 'Pour demain';
    if (d > 1) return `Dans ${d} jours`;
    return `Il y a ${-d} jour${d < -1 ? 's' : ''}`;
  }

  progress(h: TeacherHomework): number {
    return h.class_size ? Math.round((h.done_count / h.class_size) * 100) : 0;
  }

  private sort(list: TeacherHomework[]): TeacherHomework[] {
    return [...list].sort((a, b) => a.due_date.localeCompare(b.due_date));
  }

  private emptyForm() {
    return { classSubjectId: '', title: '', description: '', dueDate: isoPlus(1) };
  }

  private flash(message: string): void {
    this.notice.set(message);
    setTimeout(() => this.notice.set(''), 5000);
  }
}
