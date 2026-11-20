import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService, readableApiError } from './auth.service';

export type Relationship = 'mere' | 'pere' | 'tuteur';

export interface MyLinkRequest {
  id: string;
  child_first_name: string;
  child_last_name: string;
  declared_class_name: string | null;
  relationship: Relationship | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface ChildDeclaration {
  firstName: string;
  lastName: string;
  classId?: string;
  relationship: Relationship;
}

/**
 * The signed-in parent's requests to have a child linked to their account (`/me/...`).
 * The children themselves come from `AuthService.parentChildren()`.
 */
@Injectable({ providedIn: 'root' })
export class ParentSpaceService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = `${environment.apiUrl}/me`;

  readonly requests = signal<MyLinkRequest[]>([]);
  readonly classes = signal<{ id: string; name: string }[]>([]);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  readonly pending = computed(() => this.requests().filter(r => r.status === 'pending'));
  /** Refusals are shown so the parent knows to contact the school. */
  readonly rejected = computed(() => this.requests().filter(r => r.status === 'rejected'));

  constructor() {
    let previousUserId: string | null = null;
    effect(() => {
      const userId = this.auth.currentUser()?.id ?? null;
      if (previousUserId !== null && userId !== previousUserId) {
        this.requests.set([]);
        this.classes.set([]);
        this.loaded.set(false);
      }
      previousUserId = userId;
    });
  }

  async load(): Promise<void> {
    this.error.set(null);
    try {
      const [requests, classes] = await Promise.all([
        firstValueFrom(this.http.get<MyLinkRequest[]>(`${this.api}/link-requests`)),
        firstValueFrom(this.http.get<{ id: string; name: string }[]>(`${this.api}/classes`))
      ]);
      this.requests.set(requests);
      this.classes.set(classes);
      this.loaded.set(true);
    } catch (error) {
      this.error.set(readableApiError(error, 'Impossible de charger vos demandes.'));
    }
  }

  async declareChild(declaration: ChildDeclaration): Promise<MyLinkRequest> {
    const body: ChildDeclaration = {
      firstName: declaration.firstName.trim(),
      lastName: declaration.lastName.trim(),
      relationship: declaration.relationship,
      ...(declaration.classId ? { classId: declaration.classId } : {})
    };
    try {
      const request = await firstValueFrom(this.http.post<MyLinkRequest>(`${this.api}/link-requests`, body));
      this.requests.update(list => [request, ...list]);
      return request;
    } catch (error) {
      throw new Error(readableApiError(error, 'La demande n’a pas pu être envoyée.'));
    }
  }

  /** Re-reads children and requests, e.g. to see if the school has validated a request. */
  async refresh(): Promise<void> {
    await Promise.all([this.auth.loadChildren(), this.load()]);
  }
}
