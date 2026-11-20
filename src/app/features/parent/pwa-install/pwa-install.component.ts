import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotificationsApiService } from '../../../core/services/notifications-api.service';
import { PwaService } from '../../../core/services/pwa.service';

/** Install the app on the home screen, then turn on notifications. */
@Component({
  selector: 'app-pwa-install',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './pwa-install.component.html',
  styleUrls: ['./pwa-install.component.scss']
})
export class PwaInstallComponent implements OnInit {
  readonly pwa = inject(PwaService);
  readonly notifications = inject(NotificationsApiService);

  /** Which instructions to show; defaults to the current device. */
  readonly tab = signal<'android' | 'ios'>(this.pwa.platform === 'ios' ? 'ios' : 'android');
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);

  ngOnInit(): void {
    void this.notifications.detectPushState();
  }

  async install(): Promise<void> {
    this.busy.set(true);
    try {
      const accepted = await this.pwa.promptInstall();
      this.message.set(accepted ? 'Application installée : retrouvez-la sur votre écran d’accueil.' : null);
    } finally {
      this.busy.set(false);
    }
  }

  async enableNotifications(): Promise<void> {
    this.busy.set(true);
    this.message.set(null);
    try {
      const state = await this.notifications.enablePush();
      if (state === 'on') this.message.set('Notifications activées : vous serez prévenu(e) à chaque nouveau devoir.');
    } catch (error) {
      this.message.set((error as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
