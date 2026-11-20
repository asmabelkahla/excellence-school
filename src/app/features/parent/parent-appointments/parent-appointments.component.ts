import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { Appointment } from '../../../core/models/communication.model';

@Component({
  selector: 'app-parent-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-appointments.component.html',
  styleUrls: ['./parent-appointments.component.scss']
})
export class ParentAppointmentsComponent {
  showNewModal = false;
  selectedTeacherId = 'usr-teacher-1';
  reason = 'Évolution des résultats et participation en classe';
  note = '';
  preferredSlots = 'Mardi après-midi ou Vendredi matin';

  readonly reasons = [
    'Évolution des résultats et participation en classe',
    'Conseils d’apprentissage et devoirs à la maison',
    'Comportement et intégration avec les camarades',
    'Organisation et méthode de travail',
    'Autre sujet particulier'
  ];

  // Teachers teaching the selected child's class
  readonly availableTeachers = computed(() => {
    const child = this.auth.selectedStudent();
    if (!child?.class_id) {
      return [];
    }

    const classInfo = this.schoolData.classes().find(c => c.id === child.class_id);
    const teacherIds = classInfo?.teacher_ids?.length ? classInfo.teacher_ids : classInfo?.teacher_id ? [classInfo.teacher_id] : [];

    return teacherIds
      .map(id => {
        const teacher = this.schoolData.users().find(u => u.id === id && u.role === 'teacher');
        if (!teacher) {
          return null;
        }

        const subjectNames = this.schoolData.classSubjects()
          .filter(cs => cs.class_id === child.class_id && cs.teacher_id === teacher.id)
          .map(cs => {
            const subject = this.schoolData.subjects().find(s => s.id === cs.subject_id);
            return subject?.name_fr || 'Enseignement';
          });

        return {
          id: teacher.id,
          name: teacher.full_name,
          subject: subjectNames.length > 0 ? subjectNames.join(' • ') : 'Enseignement général'
        };
      })
      .filter((teacher): teacher is { id: string; name: string; subject: string } => teacher !== null);
  });

  // Current appointments for parent
  readonly parentAppointments = computed<Appointment[]>(() => {
    const user = this.auth.currentUser();
    const child = this.auth.selectedStudent();
    if (!user) return [];

    return this.schoolData.appointments().filter(a => {
      const isMine = a.parent_id === user.id;
      const isForSelectedChild = !child || a.student_id === child.id;
      return isMine && isForSelectedChild;
    });
  });

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {}

  submitRequest() {
    const child = this.auth.selectedStudent();
    const parent = this.auth.currentUser();
    const teacher = this.availableTeachers().find(t => t.id === this.selectedTeacherId);

    if (!child || !parent || !teacher) return;

    this.schoolData.requestAppointment({
      parent_id: parent.id,
      parent_name: parent.full_name,
      parent_phone: parent.phone,
      student_id: child.id,
      student_name: `${child.first_name} ${child.last_name}`,
      class_id: child.class_id || 'cls-3a',
      class_name: child.class_name || '3ème A',
      teacher_id: teacher.id,
      teacher_name: teacher.name,
      subject_name: teacher.subject,
      reason: this.reason,
      note: this.note,
      preferred_slots: this.preferredSlots
    });

    this.showNewModal = false;
    this.note = '';
  }

  acceptProposal(apptId: string, proposal: { starts_at: string; ends_at: string }) {
    this.schoolData.updateAppointmentStatus(apptId, 'confirmed', {
      confirmed_start: proposal.starts_at,
      confirmed_end: proposal.ends_at,
      location: 'Bureau des rendez-vous pédagogiques'
    });
  }

  cancelAppointment(apptId: string) {
    this.schoolData.updateAppointmentStatus(apptId, 'cancelled');
  }
}
