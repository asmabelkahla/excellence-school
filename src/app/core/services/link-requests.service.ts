import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LinkRequest, Student } from '../models/school.model';
import { AuthService, readableApiError } from './auth.service';

export type StudentOption = Pick<Student, 'id' | 'first_name' | 'last_name' | 'class_id' | 'class_name'>;

export interface ReviewDecision {
  decision: 'approved' | 'rejected';
  studentId?: string;
  adminNote?: string;
}

/** Parent registration requests, read from and validated through the API (admin only). */
@Injectable({ providedIn: 'root' })
export class LinkRequestsService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiUrl;

  readonly requests = signal<LinkRequest[]>([]);
  readonly students = signal<StudentOption[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  readonly pending = computed(() => this.requests().filter(r => r.status === 'pending'));
  readonly processed = computed(() => this.requests().filter(r => r.status !== 'pending'));
  readonly pendingCount = computed(() => this.pending().length);

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
      const [requests, students] = await Promise.all([
        firstValueFrom(this.http.get<LinkRequest[]>(`${this.apiBase}/auth/link-requests`)),
        firstValueFrom(this.http.get<StudentOption[]>(`${this.apiBase}/students`))
      ]);
      this.requests.set(requests);
      this.students.set(students);
      this.loaded.set(true);
    } catch (error) {
      this.error.set(readableApiError(error, 'Impossible de charger les demandes.'));
    } finally {
      this.loading.set(false);
    }
  }

  async review(requestId: string, decision: ReviewDecision): Promise<LinkRequest> {
    const body: ReviewDecision = { decision: decision.decision };
    if (decision.decision === 'approved') body.studentId = decision.studentId;
    const note = decision.adminNote?.trim();
    if (note) body.adminNote = note;

    try {
      const updated = await firstValueFrom(
        this.http.post<LinkRequest>(`${this.apiBase}/auth/link-requests/${encodeURIComponent(requestId)}/review`, body)
      );
      this.requests.update(list =>
        list.map(r => (r.id === requestId ? { ...r, ...updated, admin_note: note ?? r.admin_note } : r))
      );
      return updated;
    } catch (error) {
      throw new Error(readableApiError(error, 'La décision n’a pas pu être enregistrée.'));
    }
  }

  /** Forget cached data (on logout). */
  reset(): void {
    this.requests.set([]);
    this.students.set([]);
    this.loaded.set(false);
    this.error.set(null);
  }
}
