import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Fee } from '../../../core/models/finance.model';
import { I18nService } from '../../../core/services/i18n.service';
import { PdfService } from '../../../core/services/pdf.service';

@Component({
  selector: 'app-receipt-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './receipt-modal.component.html',
  styleUrls: ['./receipt-modal.component.scss']
})
export class ReceiptModalComponent {
  @Input() fee!: Fee;
  @Output() close = new EventEmitter<void>();

  constructor(
    public i18n: I18nService,
    private pdfService: PdfService
  ) {}

  printReceipt() {
    this.pdfService.printDocument(`Recu_Paiement_${this.fee?.reference || this.fee?.id}_Excellence_School`);
  }
}
