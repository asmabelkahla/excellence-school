import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportCard } from '../../../core/models/academics.model';
import { Student } from '../../../core/models/school.model';
import { I18nService } from '../../../core/services/i18n.service';
import { PdfService } from '../../../core/services/pdf.service';

@Component({
  selector: 'app-languages-sheet-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './languages-sheet-view.component.html',
  styleUrls: ['./languages-sheet-view.component.scss']
})
export class LanguagesSheetViewComponent {
  @Input() reportCard!: ReportCard;
  @Input() student?: Student;
  @ViewChild('sheet') sheet?: ElementRef<HTMLElement>;

  constructor(
    public i18n: I18nService,
    private pdfService: PdfService
  ) {}

  printSheet() {
    const c = this.reportCard?.content;
    const studentName = `${c?.student_first_name || this.student?.first_name || 'Eleve'}_${c?.student_last_name || this.student?.last_name || ''}`.replace(/s+/g, '_');
    this.pdfService.printDocument(`Fiche_Langues_T${this.reportCard?.trimester || 1}_${studentName}_Excellence_School`, this.sheet?.nativeElement);
  }
}
