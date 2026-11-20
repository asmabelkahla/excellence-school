import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { Student, AttendanceStatus } from '../../../core/models/school.model';

interface StudentRollCall {
  student: Student;
  status: AttendanceStatus;
}

@Component({
  selector: 'app-teacher-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacher-attendance.component.html',
  styleUrls: ['./teacher-attendance.component.scss']
})
export class TeacherAttendanceComponent {
  selectedClassId = '';
  selectedDate = new Date().toISOString().split('T')[0];
  savedMessage = false;

  studentsRoll: StudentRollCall[] = [];

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {
    this.ensureAssignedClassSelection();
    this.initRollCall();
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

  ensureAssignedClassSelection() {
    const assigned = this.getAssignedClasses();
    if (!assigned.length) {
      this.selectedClassId = '';
      return;
    }

    const currentIsAssigned = assigned.some(cls => cls.id === this.selectedClassId);
    if (!currentIsAssigned) {
      this.selectedClassId = assigned[0].id;
    }
  }

  initRollCall() {
    if (!this.selectedClassId) {
      this.studentsRoll = [];
      return;
    }

    const students = this.schoolData.students().filter(s => s.class_id === this.selectedClassId);
    const existing = this.schoolData.attendance().filter(a => a.day === this.selectedDate);

    this.studentsRoll = students.map(st => {
      const rec = existing.find(e => e.student_id === st.id);
      return {
        student: st,
        status: rec ? rec.status : 'present'
      };
    });
  }

  setStatus(item: StudentRollCall, status: AttendanceStatus) {
    item.status = status;
  }

  markAllPresent() {
    this.studentsRoll.forEach(item => item.status = 'present');
  }

  saveRollCall() {
    for (const item of this.studentsRoll) {
      this.schoolData.recordAttendance({
        student_id: item.student.id,
        student_name: `${item.student.first_name} ${item.student.last_name}`,
        class_id: this.selectedClassId,
        day: this.selectedDate,
        status: item.status,
        recorded_by: this.auth.currentUser()?.id
      });
    }

    this.savedMessage = true;
    setTimeout(() => {
      this.savedMessage = false;
    }, 3000);
  }
}
