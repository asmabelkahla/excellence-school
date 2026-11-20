import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LinkRequest } from '../../../core/models/school.model';
import { LinkRequestsService, StudentOption } from '../../../core/services/link-requests.service';

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

  readonly selectedRequest = signal<LinkRequest | null>(null);
  readonly submitting = signal<'approved' | 'rejected' | null>(null);
  readonly modalError = signal<string | null>(null);
  readonly actionSuccess = signal('');

  selectedStudentId = '';
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
    // Pre-select the best match only when it is a confident one (same first and last name).
    const best = this.studentOptions()[0];
    this.selectedStudentId = req.student_id || (best && best.score >= 2 ? best.student.id : '');
  }

  closeReview(): void {
    if (this.submitting()) return;
    this.selectedRequest.set(null);
  }

  async decide(decision: 'approved' | 'rejected'): Promise<void> {
    const req = this.selectedRequest();
    if (!req || this.submitting()) return;

    if (decision === 'approved' && !this.selectedStudentId) {
      this.modalError.set('Choisissez l’élève à rattacher avant d’approuver.');
      return;
    }

    this.submitting.set(decision);
    this.modalError.set(null);
    try {
      await this.store.review(req.id, {
        decision,
        studentId: this.selectedStudentId,
        adminNote: this.adminNote
      });
      this.selectedRequest.set(null);
      this.showSuccess(
        decision === 'approved'
          ? `Demande approuvée : ${req.parent_name ?? 'le parent'} est rattaché(e) à ${this.studentLabel(this.selectedStudentId)} et son compte est activé.`
          : `Demande refusée pour ${req.parent_name ?? 'le parent'}.`
      );
    } catch (error) {
      this.modalError.set(error instanceof Error ? error.message : 'Erreur inattendue.');
    } finally {
      this.submitting.set(null);
    }
  }

  private showSuccess(message: string): void {
    clearTimeout(this.successTimer);
    this.actionSuccess.set(message);
    this.successTimer = setTimeout(() => this.actionSuccess.set(''), 5000);
  }

  /** 1 point per matching name, 1 more for the declared class. */
  private matchScore(req: LinkRequest, s: StudentOption): number {
    let score = 0;
    if (normalize(s.first_name) === normalize(req.child_first_name)) score++;
    if (normalize(s.last_name) === normalize(req.child_last_name)) score++;
    if (req.declared_class_id ? s.class_id === req.declared_class_id
        : normalize(s.class_name) !== '' && normalize(s.class_name) === normalize(req.declared_class_name)) score++;
    return score;
  }
}
