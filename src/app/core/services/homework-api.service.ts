import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService, readableApiError } from './auth.service';

export interface TeacherHomework {
  id: string;
  class_subject_id: string;
  class_id: string;
  class_name: string | null;
  subject_name: string;
  title: string;
  description: string | null;
  due_date: string;
  created_at: string;
  done_count: number;
  class_size: number;
}

export interface ChildHomework {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  subject_name: string;
  subject_name_ar: string | null;
  teacher_name: string | null;
  created_at: string;
  done: boolean;
}

export interface HomeworkInput {
  classSubjectId: string;
  title: string;
  description: string;
  dueDate: string;
}

/** Today in the device's timezone, as YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Days between today and an ISO date (negative = late). */
export function daysUntil(iso: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / 86400000);
}

/**
 * Homework through the API.
 * For parents it also holds the selected child's list, shared by the homework page,
 * the dashboard widget and the menu badge.
 */
@Injectable({ providedIn: 'root' })
export class HomeworkApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  readonly childHomework = signal<ChildHomework[]>([]);
  readonly childLoading = signal(false);
  readonly childError = signal<string | null>(null);

  /** Still to do, from today on (late ones included). */
  readonly pendingCount = computed(() => this.childHomework().filter(h => !h.done).length);

  constructor() {
    // Follow the selected child (parents only).
    effect(() => {
      const user = this.auth.currentUser();
      const child = this.auth.selectedStudent();
      untracked(() => {
        if (user?.role === 'parent' && child && !user.must_change_password) void this.loadChild(child.id);
        else this.childHomework.set([]);
      });
    });
  }

  async loadChild(studentId: string): Promise<void> {
    this.childLoading.set(true);
    this.childError.set(null);
    try {
      const list = await this.call(this.http.get<ChildHomework[]>(`${this.api}/me/children/${encodeURIComponent(studentId)}/homework`));
      if (this.auth.selectedStudent()?.id === studentId) this.childHomework.set(list);
    } catch (error) {
      this.childError.set((error as Error).message);
    } finally {
      this.childLoading.set(false);
    }
  }

  /** Optimistic tick, rolled back if the API refuses. */
  async setDone(homeworkId: string, done: boolean): Promise<void> {
    const child = this.auth.selectedStudent();
    if (!child) return;
    const before = this.childHomework();
    this.childHomework.update(list => list.map(h => (h.id === homeworkId ? { ...h, done } : h)));
    try {
      await this.call(this.http.put(`${this.api}/me/children/${encodeURIComponent(child.id)}/homework/${encodeURIComponent(homeworkId)}/done`, { done }));
    } catch (error) {
      this.childHomework.set(before);
      throw error;
    }
  }

  // ---------------------------------------------------------------- teacher
  teacherList() {
    return this.call(this.http.get<TeacherHomework[]>(`${this.api}/teaching/homework`));
  }

  create(input: HomeworkInput) {
    return this.call(this.http.post<TeacherHomework>(`${this.api}/teaching/homework`, {
      classSubjectId: input.classSubjectId,
      title: input.title.trim(),
      description: input.description.trim(),
      dueDate: input.dueDate
    }));
  }

  update(id: string, input: Partial<HomeworkInput>) {
    const body: Record<string, string> = {};
    if (input.title !== undefined) body['title'] = input.title.trim();
    if (input.description !== undefined) body['description'] = input.description.trim();
    if (input.dueDate !== undefined) body['dueDate'] = input.dueDate;
    return this.call(this.http.patch<TeacherHomework>(`${this.api}/teaching/homework/${encodeURIComponent(id)}`, body));
  }

  remove(id: string) {
    return this.call(this.http.delete(`${this.api}/teaching/homework/${encodeURIComponent(id)}`));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw new Error(readableApiError(error));
    }
  }
}
