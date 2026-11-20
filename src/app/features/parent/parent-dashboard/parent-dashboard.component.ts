import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService, LinkedChild } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { ChildDeclaration, ParentSpaceService, Relationship } from '../../../core/services/parent-space.service';
import { HomeworkApiService } from '../../../core/services/homework-api.service';
import { CalendarApiService } from '../../../core/services/calendar-api.service';

const RELATIONSHIP_LABELS: Record<Relationship, string> = { mere: 'Mère', pere: 'Père', tuteur: 'Tuteur' };

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './parent-dashboard.component.html',
  styleUrls: ['./parent-dashboard.component.scss']
})
export class ParentDashboardComponent implements OnInit {
  readonly calendar = inject(CalendarApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  readonly schoolData = inject(SchoolDataService);
  readonly space = inject(ParentSpaceService);
  readonly homework = inject(HomeworkApiService);

  readonly relationships = Object.keys(RELATIONSHIP_LABELS) as Relationship[];
  readonly relationshipLabels = RELATIONSHIP_LABELS;

  selectedPhoto: string | null = null;

  readonly showDeclareForm = signal(false);
  readonly declaring = signal(false);
  readonly declareError = signal<string | null>(null);
  readonly declareSuccess = signal('');
  readonly refreshing = signal(false);
  declaration: ChildDeclaration = this.emptyDeclaration();

  /** Homework still to do for the selected child (from the API). */
  readonly homeworkToDo = computed(() => this.homework.pendingCount());

  ngOnInit(): void {
    void this.space.load();
  }

  async refresh(): Promise<void> {
    this.refreshing.set(true);
    await this.space.refresh();
    this.refreshing.set(false);
  }

  relationshipLabel(code?: string | null): string {
    return code ? RELATIONSHIP_LABELS[code as Relationship] ?? code : '';
  }

  childAvatar(child: LinkedChild): string {
    return child.gender === 'M' ? '👦' : '👧';
  }

  openDeclareForm(): void {
    this.declaration = this.emptyDeclaration();
    this.declareError.set(null);
    this.showDeclareForm.set(true);
  }

  /** Escape closes the dialog even when focus has left it (e.g. after a disabled button). */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showDeclareForm()) this.closeDeclareForm();
  }

  closeDeclareForm(): void {
    if (!this.declaring()) this.showDeclareForm.set(false);
  }

  async submitDeclaration(): Promise<void> {
    if (this.declaring()) return;
    if (!this.declaration.firstName.trim() || !this.declaration.lastName.trim()) {
      this.declareError.set('Le prénom et le nom de l’enfant sont obligatoires.');
      return;
    }
    this.declaring.set(true);
    this.declareError.set(null);
    try {
      const request = await this.space.declareChild(this.declaration);
      this.showDeclareForm.set(false);
      this.declareSuccess.set(
        `Demande envoyée pour ${request.child_first_name} ${request.child_last_name}. ` +
        'L’administration vérifiera le dossier avant de rattacher l’enfant à votre compte.');
      setTimeout(() => this.declareSuccess.set(''), 8000);
    } catch (error) {
      this.declareError.set((error as Error).message);
    } finally {
      this.declaring.set(false);
    }
  }

  zoomPhoto(photoPath: string) {
    this.selectedPhoto = photoPath;
  }

  closePhoto() {
    this.selectedPhoto = null;
  }

  /** The next 3 homework to do, soonest first. */
  getTodayHomework() {
    return this.homework.childHomework().filter(h => !h.done).slice(0, 3);
  }

  getNextEvent() {
    return this.calendar.upcoming()[0];
  }

  onToggleHomework(hwId: string, current: boolean) {
    void this.homework.setDone(hwId, !current).catch(() => undefined);
  }

  private emptyDeclaration(): ChildDeclaration {
    return { firstName: '', lastName: '', classId: '', relationship: 'mere' };
  }
}
