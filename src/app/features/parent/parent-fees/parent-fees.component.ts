import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { Fee } from '../../../core/models/finance.model';
import { ReceiptModalComponent } from '../../../shared/components/receipt-modal/receipt-modal.component';

@Component({
  selector: 'app-parent-fees',
  standalone: true,
  imports: [CommonModule, ReceiptModalComponent],
  templateUrl: './parent-fees.component.html',
  styleUrls: ['./parent-fees.component.scss']
})
export class ParentFeesComponent {
  selectedReceiptFee: Fee | null = null;

  readonly childFees = computed<Fee[]>(() => {
    const student = this.auth.selectedStudent();
    if (!student) return [];
    const today = new Date().toISOString().split('T')[0];
    return this.schoolData.fees()
      .filter(f => f.student_id === student.id)
      .map(f => ({
        ...f,
        is_overdue: f.status === 'pending' && f.due_date < today
      }));
  });

  readonly totals = computed(() => {
    const list = this.childFees();
    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    for (const f of list) {
      if (f.status === 'paid') {
        totalPaid += f.paid_amount || f.amount;
      } else if (f.status === 'pending') {
        if (f.is_overdue) {
          totalOverdue += f.amount;
        } else {
          totalPending += f.amount;
        }
      }
    }

    return { totalPaid, totalPending, totalOverdue };
  });

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {}

  viewReceipt(fee: Fee) {
    this.selectedReceiptFee = fee;
  }

  closeReceipt() {
    this.selectedReceiptFee = null;
  }
}
