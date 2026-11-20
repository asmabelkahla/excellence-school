import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AppNotification, NotificationsApiService } from '../../../core/services/notifications-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService, Locale } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { Student } from '../../../core/models/school.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  readonly notifications = inject(NotificationsApiService);
  private readonly router = inject(Router);
  pushBusy = false;
  pushError = '';
  showNotificationsModal = false;
  showProfileMenu = false;
  showProfileModal = false;
  showSettingsModal = false;

  profileForm = {
    full_name: '',
    phone: '',
    email: ''
  };

  settingsForm = {
    locale: 'fr' as Locale,
    notificationsEnabled: true
  };

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {}

  onSelectStudent(student: Student) {
    this.auth.selectStudent(student);
    this.showProfileMenu = false;
  }

  toggleLanguage() {
    this.i18n.toggleLocale();
  }

  toggleProfileMenu() {
    this.showProfileMenu = !this.showProfileMenu;
  }

  openProfileModal() {
    const user = this.auth.currentUser();
    this.profileForm = {
      full_name: user?.full_name || '',
      phone: user?.phone || '',
      email: user?.email || ''
    };
    this.showProfileMenu = false;
    this.showProfileModal = true;
  }

  saveProfile() {
    const user = this.auth.currentUser();
    if (!user) {
      return;
    }

    this.auth.updateCurrentUserProfile({
      full_name: this.profileForm.full_name,
      phone: this.profileForm.phone,
      email: this.profileForm.email
    });
    this.showProfileModal = false;
  }

  openSettingsModal() {
    const user = this.auth.currentUser();
    this.settingsForm = {
      locale: user?.locale || this.i18n.currentLocale(),
      notificationsEnabled: user?.notifications_enabled ?? (localStorage.getItem('esm_notifications_enabled') !== 'false')
    };
    this.showProfileMenu = false;
    this.showSettingsModal = true;
  }

  saveSettings() {
    this.auth.updateCurrentUserSettings({
      locale: this.settingsForm.locale,
      notificationsEnabled: this.settingsForm.notificationsEnabled
    });
    this.showSettingsModal = false;
  }

  logout() {
    this.auth.logout();
    this.showProfileMenu = false;
  }

  async openNotifications(): Promise<void> {
    this.showNotificationsModal = true;
    this.pushError = '';
    void this.notifications.detectPushState();
    await this.notifications.load().catch(() => undefined);
  }

  async openNotification(notif: AppNotification): Promise<void> {
    if (!notif.read_at) void this.notifications.markRead(notif.id).catch(() => undefined);
    this.showNotificationsModal = false;
    // Homework / bulletins are about one child: show that child.
    const child = notif.student_id ? this.auth.parentChildren().find(c => c.id === notif.student_id) : undefined;
    if (child) this.auth.selectStudent(child);
    if (notif.link) await this.router.navigateByUrl(notif.link);
  }

  async enablePush(): Promise<void> {
    this.pushBusy = true;
    this.pushError = '';
    try {
      await this.notifications.enablePush();
    } catch (error) {
      this.pushError = (error as Error).message;
    } finally {
      this.pushBusy = false;
    }
  }

  notifIcon(type: AppNotification['type']): string {
    return { homework: '📚', message: '💬', report_card: '📑', info: 'ℹ️' }[type] ?? '📌';
  }
}
