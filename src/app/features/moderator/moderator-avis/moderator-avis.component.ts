import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewItem } from '../../../core/models/communication.model';
import { SchoolDataService } from '../../../core/services/school-data.service';

type Status = ReviewItem['status'];
type Filter = Status | 'all';

const CATEGORY_LABELS: Record<ReviewItem['category'], string> = {
  general: 'Général',
  service: 'Services',
  'school-life': 'Vie scolaire',
  logistics: 'Logistique'
};

const STATUS_LABELS: Record<Status, string> = {
  pending: 'À modérer',
  published: 'Publié',
  archived: 'Archivé'
};

/** Moderation of the opinions shown on the public site. */
@Component({
  selector: 'app-moderator-avis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './moderator-avis.component.html',
  styleUrls: ['./moderator-avis.component.scss']
})
export class ModeratorAvisComponent {
  readonly schoolData = inject(SchoolDataService);

  readonly categoryLabels = CATEGORY_LABELS;
  readonly statusLabels = STATUS_LABELS;
  readonly categories = Object.keys(CATEGORY_LABELS) as ReviewItem['category'][];

  readonly filter = signal<Filter>('pending');
  readonly showForm = signal(false);
  readonly notice = signal('');
  form = this.emptyForm();

  readonly counts = computed(() => {
    const list = this.schoolData.reviews();
    return {
      all: list.length,
      pending: list.filter(r => r.status === 'pending').length,
      published: list.filter(r => r.status === 'published').length,
      archived: list.filter(r => r.status === 'archived').length
    };
  });

  readonly visible = computed(() => {
    const f = this.filter();
    return this.schoolData.reviews()
      .filter(r => f === 'all' || r.status === f)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  });

  readonly filters: { id: Filter; label: string }[] = [
    { id: 'pending', label: 'À modérer' },
    { id: 'published', label: 'Publiés' },
    { id: 'archived', label: 'Archivés' },
    { id: 'all', label: 'Tous' }
  ];

  add(): void {
    const f = this.form;
    if (!f.author.trim() || !f.title.trim() || !f.message.trim()) return;
    this.schoolData.addReview({
      author_name: f.author.trim(),
      category: f.category,
      title: f.title.trim(),
      message: f.message.trim(),
      status: f.publishNow ? 'published' : 'pending'
    });
    this.flash(f.publishNow ? 'Avis ajouté et publié.' : 'Avis ajouté : il attend la modération.');
    this.form = this.emptyForm();
    this.showForm.set(false);
    this.filter.set(f.publishNow ? 'published' : 'pending');
  }

  setStatus(review: ReviewItem, status: Status): void {
    this.update(list => list.map(r => (r.id === review.id ? { ...r, status } : r)));
    this.flash(status === 'published' ? 'Avis publié sur le site.' : status === 'archived' ? 'Avis archivé.' : 'Avis remis en modération.');
  }

  remove(review: ReviewItem): void {
    if (!window.confirm(`Supprimer définitivement l’avis de ${review.author_name} ?`)) return;
    this.update(list => list.filter(r => r.id !== review.id));
    this.flash('Avis supprimé.');
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
  }

  private update(fn: (list: ReviewItem[]) => ReviewItem[]): void {
    this.schoolData.reviews.update(fn);
    this.schoolData.saveToStorage();
  }

  private flash(message: string): void {
    this.notice.set(message);
    setTimeout(() => this.notice.set(''), 3500);
  }

  private emptyForm() {
    return { author: '', title: '', category: 'general' as ReviewItem['category'], message: '', publishNow: false };
  }
}
