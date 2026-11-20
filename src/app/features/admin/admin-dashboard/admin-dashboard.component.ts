import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { LinkRequestsService } from '../../../core/services/link-requests.service';
import { CalendarApiService } from '../../../core/services/calendar-api.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  readonly calendar = inject(CalendarApiService);
  readonly linkRequests = inject(LinkRequestsService);
  readonly pendingRequestsCount = this.linkRequests.pendingCount;

  readonly draftBulletinsCount = computed(() =>
    this.schoolData.reportCards().filter(rc => rc.status === 'draft').length
  );

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {}

  ngOnInit(): void {
    void this.linkRequests.load(true);
  }
}
