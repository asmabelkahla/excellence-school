import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { Student } from '../../../core/models/school.model';
import { CalendarApiService } from '../../../core/services/calendar-api.service';

@Component({
  selector: 'app-teacher-classes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './teacher-classes.component.html',
  styleUrls: ['./teacher-classes.component.scss']
})
export class TeacherClassesComponent {
  readonly calendar = inject(CalendarApiService);
  selectedClassId = '';
  noteToast = false;

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {
    const assigned = this.getAssignedClasses();
    if (assigned.length) {
      this.selectedClassId = assigned[0].id;
    }
  }

  getAssignedClasses() {
    const user = this.auth.currentUser();
    if (!user) {
      return [];
    }

    return this.schoolData.classes().filter(cls => {
      const teacherIds = cls.teacher_ids && cls.teacher_ids.length > 0 ? cls.teacher_ids : cls.teacher_id ? [cls.teacher_id] : [];
      return teacherIds.includes(user.id);
    });
  }

  getStudentsForClass(classId: string): Student[] {
    return this.schoolData.students().filter(student => student.class_id === classId);
  }

}
