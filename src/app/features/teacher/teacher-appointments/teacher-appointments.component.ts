import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { Appointment } from '../../../core/models/communication.model';

@Component({
  selector: 'app-teacher-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacher-appointments.component.html',
  styleUrls: ['./teacher-appointments.component.scss']
})
export class TeacherAppointmentsComponent {
  selectedAppt: Appointment | null = null;
  showConfirmModal = false;
  showProposeModal = false;

  confirmedDateTime = '';
  location = 'Salle des rendez-vous pédagogiques (RDC)';

  prop1Start = '';
  prop1End = '';
  prop2Start = '';
  prop2End = '';

  readonly teacherAppointments = computed<Appointment[]>(() => {
    const user = this.auth.currentUser();
    if (!user) return [];
    return this.schoolData.appointments().filter(a => a.teacher_id === user.id);
  });

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(14, 30, 0, 0);
    this.confirmedDateTime = tomorrow.toISOString().slice(0, 16);
  }

  openConfirm(appt: Appointment) {
    this.selectedAppt = appt;
    this.showConfirmModal = true;
  }

  openPropose(appt: Appointment) {
    this.selectedAppt = appt;
    this.showProposeModal = true;
  }

  confirmAppointment() {
    if (!this.selectedAppt) return;
    this.schoolData.updateAppointmentStatus(this.selectedAppt.id, 'confirmed', {
      confirmed_start: new Date(this.confirmedDateTime).toISOString(),
      location: this.location
    });
    this.showConfirmModal = false;
  }

  submitProposals() {
    if (!this.selectedAppt) return;
    const now = new Date();
    const d1 = new Date(now.getTime() + 86400000 * 3);
    const d2 = new Date(now.getTime() + 86400000 * 4);

    this.schoolData.updateAppointmentStatus(this.selectedAppt.id, 'alternatives_proposed', {
      proposals: [
        { id: 'p1', appointment_id: this.selectedAppt.id, starts_at: d1.toISOString(), ends_at: new Date(d1.getTime() + 1800000).toISOString() },
        { id: 'p2', appointment_id: this.selectedAppt.id, starts_at: d2.toISOString(), ends_at: new Date(d2.getTime() + 1800000).toISOString() }
      ]
    });
    this.showProposeModal = false;
  }

  decline(appt: Appointment) {
    this.schoolData.updateAppointmentStatus(appt.id, 'declined', {
      decline_reason: 'Contrainte d’emploi du temps. Merci de contacter la vie scolaire.'
    });
  }
}
