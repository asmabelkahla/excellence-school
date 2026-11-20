import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { AttendanceRecord } from '../../../core/models/communication.model';

@Component({
  selector: 'app-parent-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-attendance.component.html',
  styleUrls: ['./parent-attendance.component.scss']
})
export class ParentAttendanceComponent {
  showJustifyModal = false;
  selectedAttendance: AttendanceRecord | null = null;
  justificationReason = '';
  attachmentFileName = '';

  readonly childAttendance = computed<AttendanceRecord[]>(() => {
    const student = this.auth.selectedStudent();
    if (!student) return [];
    return this.schoolData.attendance().filter(a => a.student_id === student.id);
  });

  readonly stats = computed(() => {
    const records = this.childAttendance();
    const absent = records.filter(r => r.status === 'absent');
    const late = records.filter(r => r.status === 'late');
    const justified = absent.filter(r => !!r.justification).length;
    return {
      totalAbsences: absent.length,
      justified,
      unjustified: absent.length - justified,
      totalLates: late.length
    };
  });

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {}

  openJustifyModal(record: AttendanceRecord) {
    this.selectedAttendance = record;
    this.justificationReason = record.justification?.reason || '';
    this.attachmentFileName = record.justification?.attachment_path ? 'certificat_medical.pdf' : '';
    this.showJustifyModal = true;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.attachmentFileName = file.name;
    }
  }

  submitJustification() {
    if (!this.selectedAttendance || !this.justificationReason) return;

    this.schoolData.submitAbsenceJustification(
      this.selectedAttendance.id,
      this.justificationReason,
      this.attachmentFileName ? `justifications/${this.selectedAttendance.student_id}/${this.attachmentFileName}` : undefined
    );

    this.showJustifyModal = false;
    this.selectedAttendance = null;
    this.justificationReason = '';
    this.attachmentFileName = '';
  }
}
