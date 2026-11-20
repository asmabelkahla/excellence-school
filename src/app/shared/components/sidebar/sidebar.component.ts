import { Component, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { LinkRequestsService } from '../../../core/services/link-requests.service';
import { MessagesApiService } from '../../../core/services/messages-api.service';
import { HomeworkApiService } from '../../../core/services/homework-api.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  isCollapsed = false;
  private readonly linkRequests = inject(LinkRequestsService);
  readonly messages = inject(MessagesApiService);
  private readonly homework = inject(HomeworkApiService);

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {
    // The pending-requests badge is admin-only and comes from the API.
    effect(() => {
      if (this.auth.currentRole() === 'admin') untracked(() => void this.linkRequests.load());
    });
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }

  // Count pending items for badges
  getPendingLinkRequestsCount(): number {
    return this.linkRequests.pendingCount();
  }

  getPendingHomeworkCount(): number {
    // Parents: the selected child's homework still to do (from the API).
    return this.auth.isParent() ? this.homework.pendingCount() : 0;
  }

  getPendingAppointmentsCount(): number {
    return this.schoolData.appointments().filter(a => a.status === 'pending').length;
  }

  getOverdueFeesCount(): number {
    return this.schoolData.feeStatistics().count_overdue;
  }
}
