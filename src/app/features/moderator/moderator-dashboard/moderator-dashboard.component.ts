import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SchoolDataService } from '../../../core/services/school-data.service';

@Component({
  selector: 'app-moderator-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="admin-dashboard-page">
      <div class="admin-header esm-card">
        <div>
          <h2 class="esm-card-title">Espace personnel du modérateur</h2>
          <p class="text-slate-500">Gérez les actualités, avis et contenu public du site.</p>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card esm-card">
          <span class="icon">📢</span>
          <div class="info">
            <small>Actualités</small>
            <strong>{{ schoolData.news().length }}</strong>
          </div>
        </div>

        <div class="kpi-card esm-card">
          <span class="icon">💬</span>
          <div class="info">
            <small>Avis en attente</small>
            <strong>{{ pendingReviewsCount() }}</strong>
          </div>
        </div>

        <div class="kpi-card esm-card">
          <span class="icon">🏫</span>
          <div class="info">
            <small>Élèves</small>
            <strong>{{ schoolData.students().length }}</strong>
          </div>
        </div>
      </div>

      <div class="admin-cards-grid">
        <div class="esm-card">
          <div class="esm-card-header">
            <h3 class="esm-card-title">📢 Gestion des actualités</h3>
            <a routerLink="/admin/news" class="badge badge-gold">Ouvrir</a>
          </div>
          <p class="text-slate-500 text-sm mb-4">Publiez les événements, activités, annonces et rappels de l’école.</p>
        </div>

        <div class="esm-card">
          <div class="esm-card-header">
            <h3 class="esm-card-title">💬 Avis et commentaires</h3>
            <a routerLink="/moderator/avis" class="badge badge-gold">Voir</a>
          </div>
          <p class="text-slate-500 text-sm mb-4">Modérez les avis, publiez ou archivez les messages du site.</p>
        </div>
      </div>
    </div>
  `
})
export class ModeratorDashboardComponent {
  pendingReviewsCount(): number {
    return this.schoolData.reviews().filter(r => r.status === 'pending').length;
  }

  constructor(
    public auth: AuthService,
    public schoolData: SchoolDataService
  ) {}
}
