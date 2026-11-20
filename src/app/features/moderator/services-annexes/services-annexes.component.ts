import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { AnnexServicePlan, ServiceEnrollment } from '../../../core/models/school.model';

@Component({
  selector: 'app-services-annexes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './services-annexes.component.html',
  styleUrls: ['./services-annexes.component.scss']
})
export class ServicesAnnexesComponent {
  selectedType: 'bus' | 'garderie' | 'etude' = 'bus';
  formLabel = '';
  formAmount = 0;
  formDescription = '';
  selectedStudentId = '';
  selectedStudentName = '';

  readonly servicePlans = computed(() => this.schoolData.annexServicePlans());
  readonly activeEnrollments = computed(() => this.schoolData.serviceEnrollments().filter(e => e.status === 'active'));

  constructor(
    public auth: AuthService,
    public schoolData: SchoolDataService
  ) {
    this.ensureSeedPlans();
    if (this.schoolData.students().length > 0) {
      this.selectStudent(this.schoolData.students()[0]);
    }
  }

  ensureSeedPlans() {
    if (this.schoolData.annexServicePlans().length > 0) return;

    const defaultPlans: Omit<AnnexServicePlan, 'id' | 'created_at'>[] = [
      { type: 'bus', label: 'Transport scolaire', description: 'Transport domicile-école', amount: 180, active: true },
      { type: 'garderie', label: 'Garderie du matin / soir', description: 'Surveillance avant et après les cours', amount: 120, active: true },
      { type: 'etude', label: 'Étude supplémentaire', description: 'Supervision et accompagnement', amount: 150, active: true }
    ];

    defaultPlans.forEach(plan => this.schoolData.addAnnexServicePlan(plan));
  }

  selectStudent(student: { id: string; first_name: string; last_name: string }) {
    this.selectedStudentId = student.id;
    this.selectedStudentName = `${student.first_name} ${student.last_name}`;
  }

  onStudentSelection(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    const selectedId = target?.value ?? '';

    if (!selectedId) {
      this.selectedStudentId = '';
      this.selectedStudentName = '';
      return;
    }

    const student = this.schoolData.students().find(s => s.id === selectedId);
    if (student) {
      this.selectStudent(student);
    } else {
      this.selectedStudentId = '';
      this.selectedStudentName = '';
    }
  }

  selectedPlan() {
    return this.schoolData.annexServicePlans().find(p => p.type === this.selectedType) || null;
  }

  addPlan() {
    if (!this.formLabel.trim()) return;
    this.schoolData.addAnnexServicePlan({
      type: this.selectedType,
      label: this.formLabel.trim(),
      description: this.formDescription.trim() || 'Service annexes',
      amount: Number(this.formAmount) || 0,
      active: true
    });

    this.formLabel = '';
    this.formAmount = 0;
    this.formDescription = '';
  }

  enrollStudent() {
    if (!this.selectedStudentId) return;
    const plan = this.selectedPlan();
    if (!plan) return;

    const enrollment = this.schoolData.enrollStudentInService({
      student_id: this.selectedStudentId,
      student_name: this.selectedStudentName,
      parent_id: this.auth.currentUser()?.id,
      service_type: plan.type,
      service_label: plan.label,
      amount: Number(plan.amount) || Number(this.formAmount) || 0,
      status: 'active',
      start_date: new Date().toISOString().split('T')[0]
    });

    this.schoolData.addFinancialMovement({
      type: 'income',
      category: plan.type,
      label: `Abonnement ${plan.label}`,
      amount: enrollment.amount,
      student_id: enrollment.student_id,
      student_name: enrollment.student_name,
      method: 'cash',
      reference: `SRV-${Date.now()}`
    });
  }

  getServiceLabel(type: string) {
    const map: Record<string, string> = {
      bus: 'Bus',
      garderie: 'Garderie',
      etude: 'Étude supplémentaire'
    };
    return map[type] || type;
  }

  getEnrollmentsForType(type: string): ServiceEnrollment[] {
    return this.schoolData.serviceEnrollments().filter(item => item.service_type === type);
  }
}
