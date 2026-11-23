import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LinkRequest, Student } from '../models/school.model';
import { AuthService, readableApiError } from './auth.service';

export type StudentOption = Pick<Student, 'id' | 'first_name' | 'last_name' | 'class_id' | 'class_name'>;

export interface ReviewDecision {
  decision: 'approved' | 'rejected';
  /** Existing student; when empty on approval, a student is created in `classId`. */
  studentId?: string;
  classId?: string;
  adminNote?: string;
}

/** A parent who registered without declaring a child. */
export interface PendingAccount {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface ClassOption { id: string; name: string; }

/** Parent registration requests, read from and validated through the API (admin only). */
@Injectable({ providedIn: 'root' })
export class LinkRequestsService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiUrl;

  readonly requests = signal<LinkRequest[]>([]);
  readonly students = signal<StudentOption[]>([]);
  readonly classes = signal<ClassOption[]>([]);
  readonly pendingAccounts = signal<PendingAccount[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  readonly pending = computed(() => this.requests().filter(r => r.status === 'pending'));
  readonly processed = computed(() => this.requests().filter(r => r.status !== 'pending'));
  readonly pendingCount = computed(() => this.pending().length + this.pendingAccounts().length);

  constructor() {
    // Never keep another account's data after logout / session expiry.
    const auth = inject(AuthService);
    let previousUserId: string | null = null;
    effect(() => {
      const userId = auth.currentUser()?.id ?? null;
      if (previousUserId !== null && userId !== previousUserId) this.reset();
      previousUserId = userId;
    });
  }

  /** Loads once; later calls are no-ops unless `force` is set. */
  async load(force = false): Promise<void> {
    if (this.loading() || (this.loaded() && !force)) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const [requests, students, classes, accounts] = await Promise.all([
        firstValueFrom(this.http.get<LinkRequest[]>(`${this.apiBase}/auth/link-requests`)),
        firstValueFrom(this.http.get<StudentOption[]>(`${this.apiBase}/students`)),
        firstValueFrom(this.http.get<ClassOption[]>(`${this.apiBase}/classes`)),
        firstValueFrom(this.http.get<PendingAccount[]>(`${this.apiBase}/auth/pending-accounts`))
      ]);
      this.requests.set(requests);
      this.students.set(students);
      this.classes.set(classes.map(c => ({ id: c.id, name: c.name })));
      this.pendingAccounts.set(accounts);
      this.loaded.set(true);
    } catch (error) {
      this.error.set(readableApiError(error, 'Impossible de charger les demandes.'));
    } finally {
      this.loading.set(false);
    }
  }

  async review(requestId: string, decision: ReviewDecision): Promise<LinkRequest & { student_created?: boolean }> {
    const body: ReviewDecision = { decision: decision.decision };
    if (decision.decision === 'approved') {
      if (decision.studentId) body.studentId = decision.studentId;
      else if (decision.classId) body.classId = decision.classId;
    }
    const note = decision.adminNote?.trim();
    if (note) body.adminNote = note;

    try {
      const updated = await firstValueFrom(
        this.http.post<LinkRequest & { student?: StudentOption; student_created?: boolean }>(`${this.apiBase}/auth/link-requests/${encodeURIComponent(requestId)}/review`, body)
      );
      const { student, student_created, ...request } = updated;
      this.requests.update(list =>
        list.map(r => (r.id === requestId ? { ...r, ...request, admin_note: note ?? r.admin_note } : r))
      );
      // A student created at approval now exists in the school list too.
      if (student_created && student) this.students.update(list => [...list, student]);
      return updated;
    } catch (error) {
      throw new Error(readableApiError(error, 'La décision n’a pas pu être enregistrée.'));
    }
  }

  /** Opens the account of a parent who declared no child (they add children later). */
  async activateAccount(id: string): Promise<void> {
    await this.accountAction(id, 'activate', 'Le compte n’a pas pu être activé.');
  }

  /** Refuses a registration without child: the empty account is deleted. */
  async rejectAccount(id: string): Promise<void> {
    await this.accountAction(id, 'reject', 'L’inscription n’a pas pu être refusée.');
  }

  private async accountAction(id: string, action: 'activate' | 'reject', fallback: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.apiBase}/auth/pending-accounts/${encodeURIComponent(id)}/${action}`, {}));
      this.pendingAccounts.update(list => list.filter(a => a.id !== id));
    } catch (error) {
      throw new Error(readableApiError(error, fallback));
    }
  }

  /** Forget cached data (on logout). */
  reset(): void {
    this.requests.set([]);
    this.students.set([]);
    this.classes.set([]);
    this.pendingAccounts.set([]);
    this.loaded.set(false);
    this.error.set(null);
  }
}
