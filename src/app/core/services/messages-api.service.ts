import { Injectable, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService, readableApiError } from './auth.service';

export type NoteCategory = 'encouragement' | 'travail' | 'comportement' | 'information';

export const NOTE_CATEGORIES: { id: NoteCategory; label: string; icon: string }[] = [
  { id: 'encouragement', label: 'Encouragement', icon: '🌟' },
  { id: 'travail', label: 'Travail', icon: '📚' },
  { id: 'comportement', label: 'Comportement', icon: '🤝' },
  { id: 'information', label: 'Information', icon: 'ℹ️' }
];

export interface ConversationSummary {
  id: string;
  student_id: string;
  student_name: string;
  class_name: string | null;
  teacher_id: string;
  teacher_name: string;
  last_message_at: string;
  last_message: { body: string; kind: 'message' | 'note'; category: NoteCategory | null; from_me: boolean } | null;
  unread: number;
}

export interface ThreadMessage {
  id: string;
  kind: 'message' | 'note';
  category: NoteCategory | null;
  body: string;
  created_at: string;
  author_name: string;
  author_role: string | null;
  from_me: boolean;
}

export interface Thread {
  id: string;
  student_id: string;
  student_name: string;
  class_name: string | null;
  teacher_id: string;
  teacher_name: string;
  messages: ThreadMessage[];
}

/** Parent: per child, the teachers they may write to. Teacher: the students of their classes. */
export interface ParentContact {
  student_id: string;
  student_name: string;
  class_name: string | null;
  teachers: { id: string; full_name: string; subjects: string[] }[];
}

export interface TeacherContact {
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string | null;
  has_parent_account: boolean;
}

export interface NewMessage {
  body: string;
  kind?: 'message' | 'note';
  category?: NoteCategory;
}

const POLL_MS = 60_000;

/** Private parent <-> teacher threads (`/messages`). Also keeps the unread badge up to date. */
@Injectable({ providedIn: 'root' })
export class MessagesApiService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/messages`;

  readonly unread = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    const auth = inject(AuthService);
    // Poll the unread count while a parent or teacher is signed in.
    effect(() => {
      const user = auth.currentUser();
      const eligible = !!user && (user.role === 'parent' || user.role === 'teacher') && !user.must_change_password;
      untracked(() => {
        clearInterval(this.timer);
        this.unread.set(0);
        if (eligible) {
          void this.refreshUnread();
          this.timer = setInterval(() => void this.refreshUnread(), POLL_MS);
        }
      });
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  async refreshUnread(): Promise<void> {
    try {
      const { unread } = await firstValueFrom(this.http.get<{ unread: number }>(`${this.api}/unread-count`));
      this.unread.set(unread);
    } catch {
      // Badge only: ignore network errors.
    }
  }

  contacts<T extends ParentContact | TeacherContact>() {
    return this.call(this.http.get<T[]>(`${this.api}/contacts`));
  }

  conversations() {
    return this.call(this.http.get<ConversationSummary[]>(`${this.api}/conversations`));
  }

  async thread(id: string) {
    const thread = await this.call(this.http.get<Thread>(`${this.api}/conversations/${encodeURIComponent(id)}`));
    void this.refreshUnread(); // opening a thread marks it read
    return thread;
  }

  start(studentId: string, message: NewMessage, teacherId?: string) {
    return this.call(this.http.post<Thread>(`${this.api}/conversations`, {
      studentId,
      ...(teacherId ? { teacherId } : {}),
      ...this.clean(message)
    }));
  }

  post(conversationId: string, message: NewMessage) {
    return this.call(this.http.post<Thread>(`${this.api}/conversations/${encodeURIComponent(conversationId)}/messages`, this.clean(message)));
  }

  private clean(message: NewMessage): NewMessage {
    return {
      body: message.body.trim(),
      ...(message.kind === 'note' ? { kind: 'note' as const, category: message.category ?? 'information' } : {})
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
