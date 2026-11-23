import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LinkRequest } from '../../../core/models/school.model';
import { LinkRequestsService, PendingAccount, StudentOption } from '../../../core/services/link-requests.service';

/** Score of a student whose first and last names both match the declaration. */
export const SAME_NAME = 4;

const RELATIONSHIP_LABELS: Record<string, string> = { mere: 'Mère', pere: 'Père', tuteur: 'Tuteur' };

/** Normalised text for fuzzy name matching (case and accents ignored). */
function normalize(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

@Component({
  selector: 'app-link-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './link-requests.component.html',
  styleUrls: ['./link-requests.component.scss']
})
export class LinkRequestsComponent implements OnInit {
  readonly store = inject(LinkRequestsService);
  readonly SAME_NAME = SAME_NAME;

  readonly selectedRequest = signal<LinkRequest | null>(null);
  readonly submitting = signal<'approved' | 'rejected' | null>(null);
  readonly modalError = signal<string | null>(null);
  readonly actionSuccess = signal('');

  /** '' = create a new student from the declaration. */
  selectedStudentId = '';
  /** Class of the student created at approval. */
  newStudentClassId = '';
  readonly accountBusy = signal<string | null>(null);
  adminNote = '';

  /** Students sorted so the likeliest matches for the open request come first. */
  readonly studentOptions = computed(() => {
    const req = this.selectedRequest();
    const students = this.store.students();
    if (!req) return students.map(s => ({ student: s, score: 0 }));
    return students
      .map(s => ({ student: s, score: this.matchScore(req, s) }))
      .sort((a, b) => b.score - a.score);
  });

  private successTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    void this.store.load(true);
  }

  refresh(): void {
    void this.store.load(true);
  }

  relationshipLabel(code?: string | null): string {
    return code ? RELATIONSHIP_LABELS[code] ?? code : '—';
  }

  studentLabel(id?: string | null): string {
    const s = this.store.students().find(st => st.id === id);
    return s ? `${s.first_name} ${s.last_name}` : '';
  }

  openReview(req: LinkRequest): void {
    this.selectedRequest.set(req);
    this.modalError.set(null);
    this.adminNote = '';
    // Pre-select only a confident match (same first AND last name); otherwise "new student".
    const best = this.studentOptions()[0];
    this.selectedStudentId = req.student_id || (best && best.score >= SAME_NAME ? best.student.id : '');
    this.newStudentClassId = req.declared_class_id ?? '';
  }

  closeReview(): void {
    if (this.submitting()) return;
    this.selectedRequest.set(null);
  }

  async decide(decision: 'approved' | 'rejected'): Promise<void> {
    const req = this.selectedRequest();
    if (!req || this.submitting()) return;

    if (decision === 'approved' && !this.selectedStudentId && !this.newStudentClassId) {
      this.modalError.set('Choisissez la classe du nouvel élève, ou un élève déjà inscrit.');
      return;
    }

    this.submitting.set(decision);
    this.modalError.set(null);
    try {
      const result = await this.store.review(req.id, {
        decision,
        studentId: this.selectedStudentId,
        classId: this.newStudentClassId,
        adminNote: this.adminNote
      });
      this.selectedRequest.set(null);
      const child = this.studentLabel(result.student_id) || `${req.child_first_name} ${req.child_last_name}`;
      this.showSuccess(
        decision === 'approved'
          ? `Demande approuvée : ${req.parent_name ?? 'le parent'} est rattaché(e) à ${child}${result.student_created ? ' (nouvel élève ajouté à sa classe)' : ''} et son compte est activé.`
          : `Demande refusée pour ${req.parent_name ?? 'le parent'}.`
      );
    } catch (error) {
      this.modalError.set(error instanceof Error ? error.message : 'Erreur inattendue.');
    } finally {
      this.submitting.set(null);
    }
  }

  async activateAccount(account: PendingAccount): Promise<void> {
    await this.runAccountAction(account, () => this.store.activateAccount(account.id),
      `Compte de ${account.full_name} activé. Il pourra déclarer ses enfants depuis son espace.`);
  }

  async rejectAccount(account: PendingAccount): Promise<void> {
    if (!confirm(`Refuser l’inscription de ${account.full_name} ? Le compte sera supprimé.`)) return;
    await this.runAccountAction(account, () => this.store.rejectAccount(account.id),
      `Inscription de ${account.full_name} refusée.`);
  }

  private async runAccountAction(account: PendingAccount, action: () => Promise<void>, success: string): Promise<void> {
    if (this.accountBusy()) return;
    this.accountBusy.set(account.id);
    try {
      await action();
      this.showSuccess(success);
    } catch (error) {
      this.store.error.set(error instanceof Error ? error.message : 'Erreur inattendue.');
    } finally {
      this.accountBusy.set(null);
    }
  }

  private showSuccess(message: string): void {
    clearTimeout(this.successTimer);
    this.actionSuccess.set(message);
    this.successTimer = setTimeout(() => this.actionSuccess.set(''), 5000);
  }

  /** 2 points per matching name, 1 for the declared class: ≥ 4 means same first and last name. */
  matchScore(req: LinkRequest, s: StudentOption): number {
    let score = 0;
    if (normalize(s.first_name) === normalize(req.child_first_name)) score += 2;
    if (normalize(s.last_name) === normalize(req.child_last_name)) score += 2;
    if (req.declared_class_id ? s.class_id === req.declared_class_id
        : normalize(s.class_name) !== '' && normalize(s.class_name) === normalize(req.declared_class_name)) score++;
    return score;
  }
}
