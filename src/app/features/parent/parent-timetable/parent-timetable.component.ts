import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { TimetableSlot } from '../../../core/models/communication.model';

@Component({
  selector: 'app-parent-timetable',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parent-timetable.component.html',
  styleUrls: ['./parent-timetable.component.scss']
})
export class ParentTimetableComponent {
  readonly days = [
    { num: 1, nameFr: 'Lundi', nameAr: 'الإثنين' },
    { num: 2, nameFr: 'Mardi', nameAr: 'الثلاثاء' },
    { num: 3, nameFr: 'Mercredi', nameAr: 'الأربعاء' },
    { num: 4, nameFr: 'Jeudi', nameAr: 'الخميس' },
    { num: 5, nameFr: 'Vendredi', nameAr: 'الجمعة' }
  ];

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {}

  getSlotsForDay(weekday: number): TimetableSlot[] {
    return this.schoolData.getStudentScopedTimetable(this.auth.selectedStudent())
      .filter(s => s.weekday === weekday)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }
}
