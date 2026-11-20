import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { NewsCategory } from '../../../core/models/school.model';

@Component({
  selector: 'app-news-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './news-admin.component.html',
  styleUrls: ['./news-admin.component.scss']
})
export class NewsAdminComponent {
  showNewModal = false;
  titleFr = '';
  titleAr = '';
  bodyFr = '';
  bodyAr = '';
  category: NewsCategory = 'info';
  pinned = false;
  successMessage = '';

  constructor(
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {}

  publishNews() {
    if (!this.titleFr) return;

    this.schoolData.addNews({
      title_fr: this.titleFr,
      title_ar: this.titleAr,
      body_fr: this.bodyFr,
      body_ar: this.bodyAr,
      category: this.category,
      cover_path: 'assets/logo.jpg',
      pinned: this.pinned,
      published: true,
      publish_at: new Date().toISOString()
    });

    this.showNewModal = false;
    this.titleFr = '';
    this.titleAr = '';
    this.bodyFr = '';
    this.bodyAr = '';
    this.successMessage = 'Actualité publiée avec succès dans le fil d’accueil des parents !';
    setTimeout(() => this.successMessage = '', 4000);
  }
}
