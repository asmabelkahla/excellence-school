import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ChildHomework, HomeworkApiService, daysUntil } from '../../../core/services/homework-api.service';
import { NotificationsApiService } from '../../../core/services/notifications-api.service';

interface Group {
  key: string;
  label: string;
  items: ChildHomework[];
}

@Component({
  selector: 'app-parent-homework',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './parent-homework.component.html',
  styleUrls: ['./parent-homework.component.scss']
})
export class ParentHomeworkComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly homework = inject(HomeworkApiService);
  readonly notifications = inject(NotificationsApiService);

  readonly showDone = signal(false);
  readonly expanded = signal<string | null>(null);
  readonly toast = signal('');
  readonly error = signal<string | null>(null);
  readonly pushBusy = signal(false);

  /** To-do grouped by urgency; done items in their own group. */
  readonly groups = computed<Group[]>(() => {
    const todo = this.homework.childHomework().filter(h => !h.done);
    const buckets: Group[] = [
      { key: 'late', label: '⚠️ En retard', items: todo.filter(h => daysUntil(h.due_date) < 0) },
      { key: 'today', label: 'Pour aujourd’hui', items: todo.filter(h => daysUntil(h.due_date) === 0) },
      { key: 'tomorrow', label: 'Pour demain', items: todo.filter(h => daysUntil(h.due_date) === 1) },
      { key: 'week', label: 'Cette semaine', items: todo.filter(h => daysUntil(h.due_date) > 1 && daysUntil(h.due_date) <= 7) },
      { key: 'later', label: 'Plus tard', items: todo.filter(h => daysUntil(h.due_date) > 7) }
    ];
    return buckets.filter(g => g.items.length);
  });

  readonly doneList = computed(() => this.homework.childHomework().filter(h => h.done).reverse());

  ngOnInit(): void {
    // Fresh data each time the page is opened (a notification may have just arrived).
    const child = this.auth.selectedStudent();
    if (child) void this.homework.loadChild(child.id);
    void this.notifications.detectPushState();
  }

  async toggle(h: ChildHomework): Promise<void> {
    this.error.set(null);
    try {
      await this.homework.setDone(h.id, !h.done);
      if (!h.done) {
        this.toast.set(`🌟 Bravo ${this.auth.selectedStudent()?.first_name ?? ''} ! « ${h.title} » est fait.`);
        setTimeout(() => this.toast.set(''), 3000);
      }
    } catch (error) {
      this.error.set((error as Error).message);
    }
  }

  toggleDetails(id: string): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  async enablePush(): Promise<void> {
    this.pushBusy.set(true);
    this.error.set(null);
    try {
      await this.notifications.enablePush();
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.pushBusy.set(false);
    }
  }

  dueText(iso: string): string {
    const d = daysUntil(iso);
    if (d < -1) return `en retard de ${-d} jours`;
    if (d === -1) return 'c’était pour hier';
    if (d === 0) return 'pour aujourd’hui';
    if (d === 1) return 'pour demain';
    return `dans ${d} jours`;
  }

  isNew(h: ChildHomework): boolean {
    return Date.now() - Date.parse(h.created_at) < 24 * 3600 * 1000;
  }
}
