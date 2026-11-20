import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EventItem } from '../models/communication.model';
import { AuthService, readableApiError } from './auth.service';

export interface EventInput {
  title: string;
  description: string;
  category: EventItem['category'];
  visibility: 'public' | 'private';
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
}

/** Roles allowed to create, edit and delete events (the API enforces the same rule). */
export const CALENDAR_EDITORS = ['admin', 'moderator'];

/**
 * School calendar through the API (`/events`).
 * Parents only ever receive public events — the server filters them.
 */
@Injectable({ providedIn: 'root' })
export class CalendarApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = `${environment.apiUrl}/events`;

  /** Events of the period shown in the calendar page. */
  readonly events = signal<EventItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Next 60 days, for the dashboard widgets. */
  readonly upcoming = signal<EventItem[]>([]);

  readonly canEdit = computed(() => CALENDAR_EDITORS.includes(this.auth.currentRole() ?? ''));

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      untracked(() => {
        this.events.set([]);
        this.upcoming.set([]);
        if (user && !user.must_change_password) void this.loadUpcoming();
      });
    });
  }

  async loadRange(from: Date, to: Date): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.events.set(await this.fetch(from, to));
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async loadUpcoming(): Promise<void> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    try {
      this.upcoming.set(await this.fetch(start, new Date(start.getTime() + 60 * 86400000)));
    } catch {
      // widgets only
    }
  }

  async create(input: EventInput): Promise<EventItem> {
    const evt = this.map(await this.call(this.http.post<ApiEvent>(this.api, this.body(input))));
    this.events.update(list => [...list, evt]);
    void this.loadUpcoming();
    return evt;
  }

  async update(id: string, input: EventInput): Promise<EventItem> {
    const evt = this.map(await this.call(this.http.patch<ApiEvent>(`${this.api}/${encodeURIComponent(id)}`, this.body(input))));
    this.events.update(list => list.map(e => (e.id === id ? evt : e)));
    void this.loadUpcoming();
    return evt;
  }

  async remove(id: string): Promise<void> {
    await this.call(this.http.delete(`${this.api}/${encodeURIComponent(id)}`));
    this.events.update(list => list.filter(e => e.id !== id));
    void this.loadUpcoming();
  }

  private async fetch(from: Date, to: Date): Promise<EventItem[]> {
    const params = new HttpParams().set('from', from.toISOString()).set('to', to.toISOString());
    const list = await this.call(this.http.get<ApiEvent[]>(this.api, { params }));
    return list.map(e => this.map(e));
  }

  private body(input: EventInput) {
    return {
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      visibility: input.visibility,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      allDay: input.allDay
    };
  }

  private map(e: ApiEvent): EventItem {
    return {
      id: e.id,
      title: e.title,
      description: e.description ?? undefined,
      category: e.category,
      visibility: e.visibility,
      starts_at: e.starts_at,
      ends_at: e.ends_at ?? undefined,
      all_day: e.all_day,
      created_by: e.created_by ?? undefined
    };
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw new Error(readableApiError(error));
    }
  }
}

interface ApiEvent {
  id: string;
  title: string;
  description: string | null;
  category: EventItem['category'];
  visibility: 'public' | 'private';
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  created_by?: string | null;
}
