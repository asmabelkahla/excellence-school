import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { Fee } from '../../../core/models/finance.model';
import { ReceiptModalComponent } from '../../../shared/components/receipt-modal/receipt-modal.component';

@Component({
  selector: 'app-payments-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, ReceiptModalComponent],
  templateUrl: './payments-overview.component.html',
  styleUrls: ['./payments-overview.component.scss']
})
export class PaymentsOverviewComponent {
  filterClass = 'all';
  filterStatus = 'all';
  searchQuery = '';
  selectedReceiptFee: Fee | null = null;

  readonly financialSummary = computed(() => this.schoolData.financialSummary());

  readonly filteredFees = computed<Fee[]>(() => {
    let list = this.schoolData.fees();
    const today = new Date().toISOString().split('T')[0];

    // Compute overdue flag
    list = list.map(f => ({
      ...f,
      is_overdue: f.status === 'pending' && f.due_date < today
    }));

    if (this.filterClass !== 'all') {
      list = list.filter(f => f.class_name === this.filterClass);
    }

    if (this.filterStatus === 'paid') {
      list = list.filter(f => f.status === 'paid');
    } else if (this.filterStatus === 'pending') {
      list = list.filter(f => f.status === 'pending' && !f.is_overdue);
    } else if (this.filterStatus === 'overdue') {
      list = list.filter(f => f.is_overdue);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(f =>
        f.student_name?.toLowerCase().includes(q) ||
        f.label.toLowerCase().includes(q) ||
        (f.reference && f.reference.toLowerCase().includes(q))
      );
    }

    return list;
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
