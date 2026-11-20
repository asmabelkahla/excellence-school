import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventItem } from '../../../core/models/communication.model';
import { I18nService } from '../../../core/services/i18n.service';
import { CalendarApiService } from '../../../core/services/calendar-api.service';
import { AuthService } from '../../../core/services/auth.service';

interface EventFormState {
  title: string;
  description: string;
  date: string;
  category: EventItem['category'];
  /** public = visible to parents; private = staff only. */
  visibility: 'public' | 'private';
  all_day: boolean;
  start_time: string;
  end_time: string;
}

interface DayCell {
  key: string;
  date: Date;
  isToday: boolean;
  /** Month view: false for the leading / trailing days of the neighbouring months. */
  inMonth: boolean;
  events: EventItem[];
}

export const EVENT_CATEGORIES: { id: EventItem['category']; label: string }[] = [
  { id: 'reunion', label: 'Réunion' },
  { id: 'examen', label: 'Examen' },
  { id: 'vacances', label: 'Vacances' },
  { id: 'fete', label: 'Fête' },
  { id: 'sortie', label: 'Sortie' },
  { id: 'autre', label: 'Autre' }
];

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

@Component({
  selector: 'app-calendar-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './calendar-admin.component.html',
  styleUrls: ['./calendar-admin.component.scss']
})
export class CalendarAdminComponent {
  readonly cal = inject(CalendarApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  /** Admin and moderator only; everyone else gets a read-only calendar. */
  readonly canEdit = this.cal.canEdit;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal('');
  readonly categories = EVENT_CATEGORIES;
  readonly weekdayNames = WEEKDAYS;

  /** Month view by default: the whole period at a glance. */
  readonly view = signal<'month' | 'week'>('month');
  /** Any date inside the period currently shown. */
  readonly anchor = signal(this.startOfDay(new Date()));
  readonly selectedDate = signal(this.toDateKey(new Date()));
  readonly editingEventId = signal<string | null>(null);
  readonly form = signal<EventFormState>(this.emptyForm(this.toDateKey(new Date())));

  readonly weekDays = computed<DayCell[]>(() => {
    const start = this.startOfWeek(this.anchor());
    return Array.from({ length: 7 }, (_, i) => this.cell(this.addDays(start, i), true));
  });

  /** 6 rows × 7 days, starting on the Monday before the 1st. */
  readonly monthDays = computed<DayCell[]>(() => {
    const first = new Date(this.anchor().getFullYear(), this.anchor().getMonth(), 1);
    const start = this.startOfWeek(first);
    const month = first.getMonth();
    const cells = Array.from({ length: 42 }, (_, i) => {
      const d = this.addDays(start, i);
      return this.cell(d, d.getMonth() === month);
    });
    // Drop a trailing week made only of next-month days.
    return cells.slice(35).every(c => !c.inMonth) ? cells.slice(0, 35) : cells;
  });

  readonly periodTitle = computed(() => {
    if (this.view() === 'month') {
      const label = this.anchor().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    const days = this.weekDays();
    const from = days[0].date;
    const to = days[6].date;
    const sameMonth = from.getMonth() === to.getMonth();
    return `Semaine du ${from.getDate()}${sameMonth ? '' : ' ' + from.toLocaleDateString('fr-FR', { month: 'long' })} au ${to.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  });

  readonly monthEventCount = computed(() => this.monthDays().filter(c => c.inMonth).reduce((n, c) => n + c.events.length, 0));

  constructor() {
    // Load the events of the period on screen (month grid or week).
    effect(() => {
      const cells = this.view() === 'month' ? this.monthGridDates() : this.weekDates();
      const from = cells[0];
      const to = new Date(cells[cells.length - 1].getTime() + 86400000 - 1);
      untracked(() => void this.cal.loadRange(from, to));
    });
  }

  /** Dates only (no events): used to know which period to load. */
  private readonly monthGridDates = computed(() => {
    const first = new Date(this.anchor().getFullYear(), this.anchor().getMonth(), 1);
    const start = this.startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => this.addDays(start, i));
  });

  private readonly weekDates = computed(() => {
    const start = this.startOfWeek(this.anchor());
    return Array.from({ length: 7 }, (_, i) => this.addDays(start, i));
  });

  get selectedDayEvents(): EventItem[] {
    return this.getEventsForDay(this.selectedDate());
  }

  getEventsForDay(dateKey: string): EventItem[] {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
    return this.cal.events()
      .filter(event => {
        const start = new Date(event.starts_at);
        const end = event.ends_at ? new Date(event.ends_at) : start;
        return start <= dayEnd && end >= dayStart;
      })
      .sort((a, b) => Number(!a.all_day) - Number(!b.all_day) || a.starts_at.localeCompare(b.starts_at));
  }

  // ------------------------------------------------------------- navigation

  setView(view: 'month' | 'week'): void {
    this.view.set(view);
    // Keep the selected day in view when switching.
    const [y, m, d] = this.selectedDate().split('-').map(Number);
    this.anchor.set(new Date(y, m - 1, d));
  }

  previous(): void {
    this.move(-1);
  }

  next(): void {
    this.move(1);
  }

  today(): void {
    const now = this.startOfDay(new Date());
    this.anchor.set(now);
    this.selectDate(this.toDateKey(now));
  }

  selectDate(dateKey: string): void {
    this.selectedDate.set(dateKey);
    if (!this.editingEventId()) this.form.set(this.emptyForm(dateKey));
  }

  openCreateForDate(dateKey: string): void {
    this.editingEventId.set(null);
    this.form.set(this.emptyForm(dateKey));
  }

  // ----------------------------------------------------------------- events

  openEditEvent(event: EventItem): void {
    this.editingEventId.set(event.id);
    const date = this.toDateKey(new Date(event.starts_at));
    const allDay = !!event.all_day || !event.starts_at.includes('T');
    this.form.set({
      title: event.title,
      description: event.description || '',
      date,
      category: event.category,
      visibility: event.visibility ?? 'public',
      all_day: allDay,
      start_time: allDay ? '09:00' : new Date(event.starts_at).toTimeString().slice(0, 5),
      end_time: allDay ? '10:00' : event.ends_at ? new Date(event.ends_at).toTimeString().slice(0, 5) : '10:00'
    });
    this.selectedDate.set(date);
  }

  async saveEvent(): Promise<void> {
    const f = this.form();
    const title = f.title.trim();
    if (!title || !f.date || this.saving() || !this.canEdit()) return;
    if (!f.all_day && f.end_time < f.start_time) {
      this.error.set('L’heure de fin doit être après l’heure de début.');
      return;
    }

    const input = {
      title,
      description: f.description,
      category: f.category,
      visibility: f.visibility,
      startsAt: this.buildIsoDate(f.date, f.all_day ? null : f.start_time),
      endsAt: f.all_day ? null : this.buildIsoDate(f.date, f.end_time),
      allDay: f.all_day
    };

    this.saving.set(true);
    this.error.set(null);
    try {
      const id = this.editingEventId();
      if (id) await this.cal.update(id, input);
      else await this.cal.create(input);
      this.flash(id ? 'Événement modifié.' : f.visibility === 'public' ? 'Événement ajouté : visible par les parents.' : 'Événement privé ajouté : visible par le personnel uniquement.');
      this.editingEventId.set(null);
      this.selectedDate.set(f.date);
      this.form.set(this.emptyForm(f.date));
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async deleteEvent(event: EventItem): Promise<void> {
    if (!this.canEdit() || !window.confirm(`Supprimer l’événement « ${event.title} » ?`)) return;
    try {
      await this.cal.remove(event.id);
      if (this.editingEventId() === event.id) this.cancelEdit();
      this.flash('Événement supprimé.');
    } catch (error) {
      this.error.set((error as Error).message);
    }
  }

  private flash(message: string): void {
    this.notice.set(message);
    setTimeout(() => this.notice.set(''), 3500);
  }

  cancelEdit(): void {
    this.editingEventId.set(null);
    this.form.set(this.emptyForm(this.selectedDate()));
  }

  patchForm(changes: Partial<EventFormState>): void {
    this.form.update(f => ({ ...f, ...changes }));
  }

  categoryLabel(id: EventItem['category']): string {
    return this.categories.find(c => c.id === id)?.label ?? id;
  }

  formatTimeRange(event: EventItem): string {
    if (event.all_day) return 'Toute la journée';
    const start = new Date(event.starts_at);
    const end = event.ends_at ? new Date(event.ends_at) : start;
    return `${this.pad(start.getHours())}:${this.pad(start.getMinutes())} – ${this.pad(end.getHours())}:${this.pad(end.getMinutes())}`;
  }

  // ---------------------------------------------------------------- helpers

  private move(step: number): void {
    const a = this.anchor();
    this.anchor.set(this.view() === 'month'
      ? new Date(a.getFullYear(), a.getMonth() + step, 1)
      : this.addDays(a, 7 * step));
  }

  private cell(date: Date, inMonth: boolean): DayCell {
    const key = this.toDateKey(date);
    return { key, date, inMonth, isToday: key === this.toDateKey(new Date()), events: this.getEventsForDay(key) };
  }

  private emptyForm(date: string): EventFormState {
    return { title: '', description: '', date, category: 'reunion', visibility: 'public', all_day: true, start_time: '09:00', end_time: '10:00' };
  }

  private buildIsoDate(dateKey: string, time?: string | null): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    const base = new Date(year, month - 1, day);
    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      base.setHours(hours, minutes, 0, 0);
    }
    return base.toISOString();
  }

  private startOfWeek(date: Date): Date {
    const d = this.startOfDay(date);
    const day = d.getDay();
    return this.addDays(d, day === 0 ? -6 : 1 - day);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  private toDateKey(date: Date): string {
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }
}
