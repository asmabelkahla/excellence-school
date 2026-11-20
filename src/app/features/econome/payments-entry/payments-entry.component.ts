import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { Fee, PaymentMethod, PaymentType } from '../../../core/models/finance.model';
import { Student } from '../../../core/models/school.model';
import { ReceiptModalComponent } from '../../../shared/components/receipt-modal/receipt-modal.component';

@Component({
  selector: 'app-payments-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, ReceiptModalComponent],
  templateUrl: './payments-entry.component.html',
  styleUrls: ['./payments-entry.component.scss']
})
export class PaymentsEntryComponent {
  searchQuery = '';
  selectedStudent: Student | null = null;
  selectedFee: Fee | null = null;

  // Payment Form Fields
  payAmount = 0;
  payMethod: PaymentMethod = 'cash';
  selectedPaymentType: PaymentType = 'mensualite';
  payRef = '';
  payNote = '';

  readonly paymentTypeOptions: Array<{ value: PaymentType; label: string }> = [
    { value: 'mensualite', label: 'Mensualité' },
    { value: 'inscription', label: 'Inscription' },
    { value: 'club', label: 'Club' },
    { value: 'garde', label: 'Garde' },
    { value: 'transport', label: 'Transport' },
    { value: 'etude_supplementaire', label: 'Étude supplémentaire' }
  ];

  receiptFee: Fee | null = null;

  readonly searchResults = computed<Student[]>(() => {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.schoolData.students().slice(0, 5);
    return this.schoolData.students().filter(s =>
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      (s.first_name_ar && s.first_name_ar.includes(q))
    );
  });

  readonly studentPendingFees = computed<Fee[]>(() => {
    if (!this.selectedStudent) return [];
    return this.schoolData.fees().filter(
      f => f.student_id === this.selectedStudent!.id && f.status === 'pending'
    );
  });

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {
    // Select first student by default
    const students = this.schoolData.students();
    if (students.length > 0) {
      this.selectStudent(students[0]);
    }
  }

  selectStudent(st: Student) {
    this.selectedStudent = st;
    const fees = this.schoolData.fees().filter(f => f.student_id === st.id && f.status === 'pending');
    if (fees.length > 0) {
      this.selectFee(fees[0]);
    } else {
      this.selectedFee = null;
    }
  }

  selectFee(fee: Fee) {
    this.selectedFee = fee;
    this.payAmount = fee.amount;
    this.payRef = 'REC-2026-' + Math.floor(1000 + Math.random() * 9000);
  }

  selectPaymentType(type: PaymentType) {
    this.selectedPaymentType = type;
    if (!this.payNote) {
      this.payNote = this.paymentTypeOptions.find(option => option.value === type)?.label || 'Paiement';
    }
  }

  submitPayment() {
    if (!this.selectedFee || !this.payAmount) return;

    const paymentTypeLabel = this.paymentTypeOptions.find(option => option.value === this.selectedPaymentType)?.label || 'Paiement';
    const finalNote = this.payNote.trim() ? `${paymentTypeLabel} • ${this.payNote.trim()}` : paymentTypeLabel;

    this.schoolData.recordPayment(
      this.selectedFee.id,
      this.payAmount,
      this.payMethod,
      this.payRef,
      finalNote
    );

    // Open receipt modal
    this.receiptFee = {
      ...this.selectedFee,
      status: 'paid',
      paid_amount: this.payAmount,
      paid_at: new Date().toISOString().split('T')[0],
      method: this.payMethod,
      reference: this.payRef,
      note: finalNote,
      payment_type: this.selectedPaymentType
    };

    // Refresh pending fees
    if (this.selectedStudent) {
      this.selectStudent(this.selectedStudent);
    }
  }

  closeReceipt() {
    this.receiptFee = null;
  }
}
