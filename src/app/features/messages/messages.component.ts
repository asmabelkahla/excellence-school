import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  ConversationSummary,
  MessagesApiService,
  NOTE_CATEGORIES,
  NoteCategory,
  ParentContact,
  TeacherContact,
  Thread
} from '../../core/services/messages-api.service';

/**
 * Private "carnet de liaison" between the parents of a student and one of their teachers.
 * The same page serves both roles; the API enforces who can read what.
 */
@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss']
})
export class MessagesComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly messages = inject(MessagesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild('scrollBox') scrollBox?: ElementRef<HTMLElement>;

  readonly categories = NOTE_CATEGORIES;
  readonly isTeacher = computed(() => this.auth.currentRole() === 'teacher');

  readonly list = signal<ConversationSummary[]>([]);
  readonly thread = signal<Thread | null>(null);
  readonly loading = signal(true);
  readonly threadLoading = signal(false);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  // Reply box
  reply = '';
  replyKind: 'message' | 'note' = 'message';
  replyCategory: NoteCategory = 'encouragement';

  // New conversation
  readonly composing = signal(false);
  readonly parentContacts = signal<ParentContact[]>([]);
  readonly teacherContacts = signal<TeacherContact[]>([]);
  draft = { studentId: '', teacherId: '', classId: '', body: '', kind: 'message' as 'message' | 'note', category: 'encouragement' as NoteCategory };

  readonly teacherClasses = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.teacherContacts()) map.set(c.class_id, c.class_name ?? c.class_id);
    return [...map].map(([id, name]) => ({ id, name }));
  });

  async ngOnInit(): Promise<void> {
    await this.loadList();
    const params = this.route.snapshot.queryParamMap;
    const wanted = params.get('c');
    if (wanted) await this.open(wanted);
    else if (params.has('nouveau')) await this.startCompose();
  }

  async loadList(): Promise<void> {
    this.error.set(null);
    try {
      this.list.set(await this.messages.conversations());
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async open(id: string): Promise<void> {
    this.composing.set(false);
    this.threadLoading.set(true);
    this.error.set(null);
    try {
      this.thread.set(await this.messages.thread(id));
      this.list.update(l => l.map(c => (c.id === id ? { ...c, unread: 0 } : c)));
      void this.router.navigate([], { queryParams: { c: id }, replaceUrl: true });
      this.scrollToEnd();
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.threadLoading.set(false);
    }
  }

  close(): void {
    this.thread.set(null);
    this.composing.set(false);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  async send(): Promise<void> {
    const thread = this.thread();
    if (!thread || !this.reply.trim() || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      const kind = this.isTeacher() ? this.replyKind : 'message';
      this.thread.set(await this.messages.post(thread.id, { body: this.reply, kind, category: this.replyCategory }));
      this.reply = '';
      this.replyKind = 'message';
      await this.loadList();
      this.scrollToEnd();
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.sending.set(false);
    }
  }

  /** Ctrl/Cmd + Enter sends. */
  onReplyKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void this.send();
    }
  }

  async startCompose(): Promise<void> {
    this.thread.set(null);
    this.composing.set(true);
    this.error.set(null);
    try {
      if (this.isTeacher()) {
        const contacts = await this.messages.contacts<TeacherContact>();
        this.teacherContacts.set(contacts);
        const firstClass = contacts[0]?.class_id ?? '';
        this.draft = { ...this.draft, classId: firstClass, studentId: '', body: '', kind: 'note' };
      } else {
        const contacts = await this.messages.contacts<ParentContact>();
        this.parentContacts.set(contacts);
        // Prefer the selected child, but only if someone teaches in their class.
        const reachable = contacts.filter(c => c.teachers.length);
        const child = reachable.find(c => c.student_id === this.auth.selectedStudent()?.id) ?? reachable[0] ?? contacts[0];
        this.draft = { ...this.draft, studentId: child?.student_id ?? '', teacherId: child?.teachers[0]?.id ?? '', body: '', kind: 'message' };
      }
    } catch (error) {
      this.error.set((error as Error).message);
    }
  }

  teachersForDraft() {
    return this.parentContacts().find(c => c.student_id === this.draft.studentId)?.teachers ?? [];
  }

  studentsForDraft() {
    return this.teacherContacts().filter(c => c.class_id === this.draft.classId);
  }

  selectedTeacherContact(): TeacherContact | undefined {
    return this.teacherContacts().find(c => c.student_id === this.draft.studentId);
  }

  onDraftChildChange(): void {
    this.draft.teacherId = this.teachersForDraft()[0]?.id ?? '';
  }

  canSendDraft(): boolean {
    return !!this.draft.studentId && !!this.draft.body.trim() && (this.isTeacher() || !!this.draft.teacherId);
  }

  async sendDraft(): Promise<void> {
    if (!this.canSendDraft() || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      const thread = await this.messages.start(
        this.draft.studentId,
        { body: this.draft.body, kind: this.isTeacher() ? this.draft.kind : 'message', category: this.draft.category },
        this.isTeacher() ? undefined : this.draft.teacherId
      );
      this.composing.set(false);
      this.thread.set(thread);
      await this.loadList();
      void this.router.navigate([], { queryParams: { c: thread.id }, replaceUrl: true });
      this.scrollToEnd();
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.sending.set(false);
    }
  }

  categoryOf(id: NoteCategory | null) {
    return this.categories.find(c => c.id === id) ?? this.categories[3];
  }

  /** Title of a thread from the reader's point of view. */
  counterpart(c: { teacher_name: string; student_name: string }): string {
    return this.isTeacher() ? `Parents de ${c.student_name}` : c.teacher_name;
  }

  private scrollToEnd(): void {
    setTimeout(() => {
      const el = this.scrollBox?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
