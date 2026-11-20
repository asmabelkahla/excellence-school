import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService, readableApiError } from './auth.service';

export interface AppNotification {
  id: string;
  type: 'homework' | 'message' | 'report_card' | 'info';
  title: string;
  body: string;
  link: string | null;
  student_id: string | null;
  created_at: string;
  read_at: string | null;
}

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

const POLL_MS = 60_000;

/**
 * In-app notifications (the bell) and Web Push on this device.
 * Push needs the service worker (production build) and, on iPhone, the app installed on the home screen.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  private readonly swPush = inject(SwPush);
  private readonly api = environment.apiUrl;

  readonly items = signal<AppNotification[]>([]);
  readonly unread = signal(0);
  readonly pushState = signal<PushState>('off');
  private timer?: ReturnType<typeof setInterval>;
  /** This device's push endpoint, kept in memory so sign-out can unregister it synchronously. */
  private endpoint: string | null = null;

  constructor() {
    const auth = inject(AuthService);
    effect(() => {
      const user = auth.currentUser();
      const signedIn = !!user && !user.must_change_password;
      untracked(() => {
        clearInterval(this.timer);
        this.items.set([]);
        this.unread.set(0);
        if (signedIn) {
          void this.refreshUnread();
          this.timer = setInterval(() => void this.refreshUnread(), POLL_MS);
          void this.detectPushState();
        }
      });
    });

    // Signing out on a shared phone: this device must stop receiving this account's notifications.
    auth.onLogout(() => this.unregisterDevice());

    // A push arrived while the app is open: refresh the bell right away.
    if (this.swPush.isEnabled) {
      this.swPush.messages.subscribe(() => void this.refreshUnread());
      this.swPush.subscription.subscribe(sub => (this.endpoint = sub?.endpoint ?? null));
    }
  }

  async refreshUnread(): Promise<void> {
    try {
      const { unread } = await firstValueFrom(this.http.get<{ unread: number }>(`${this.api}/notifications/unread-count`));
      this.unread.set(unread);
    } catch {
      // badge only
    }
  }

  async load(): Promise<void> {
    this.items.set(await firstValueFrom(this.http.get<AppNotification[]>(`${this.api}/notifications`)));
  }

  async markRead(id?: string): Promise<void> {
    const url = id ? `${this.api}/notifications/${encodeURIComponent(id)}/read` : `${this.api}/notifications/read-all`;
    const { unread } = await firstValueFrom(this.http.post<{ unread: number }>(url, {}));
    this.unread.set(unread);
    const now = new Date().toISOString();
    this.items.update(list => list.map(n => (!id || n.id === id ? { ...n, read_at: n.read_at ?? now } : n)));
  }

  // ------------------------------------------------------------------- push

  async detectPushState(): Promise<PushState> {
    const state = await this.computePushState();
    this.pushState.set(state);
    return state;
  }

  /** Asks the permission (must follow a user tap) and registers this device. */
  async enablePush(): Promise<PushState> {
    const state = await this.computePushState();
    if (state === 'unsupported' || state === 'needs-install' || state === 'denied') {
      this.pushState.set(state);
      return state;
    }
    try {
      const { publicKey } = await firstValueFrom(this.http.get<{ publicKey: string | null }>(`${this.api}/push/public-key`));
      if (!publicKey) throw new Error('Les notifications push ne sont pas encore configurées sur le serveur.');
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
      await firstValueFrom(this.http.post(`${this.api}/push/subscribe`, subscription.toJSON()));
      this.pushState.set('on');
      return 'on';
    } catch (error) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        this.pushState.set('denied');
        return 'denied';
      }
      if (error instanceof HttpErrorResponse) {
        throw new Error(readableApiError(error, 'Impossible d’activer les notifications sur cet appareil.'));
      }
      if (error instanceof Error && error.message.startsWith('Les notifications push')) throw error;
      // Browser errors (DOMException) are in English and technical: say it simply.
      throw new Error('Ce navigateur a refusé l’activation (navigation privée ou réglages). Essayez depuis l’application installée ou un autre navigateur.');
    }
  }

  async disablePush(): Promise<void> {
    const sub = await firstValueFrom(this.swPush.subscription);
    if (sub) {
      await firstValueFrom(this.http.delete(`${this.api}/push/subscribe`, { body: { endpoint: sub.endpoint } })).catch(() => undefined);
      await sub.unsubscribe();
    }
    this.pushState.set('off');
  }

  /** Removes this device from the account server-side, then locally. */
  private async unregisterDevice(): Promise<void> {
    if (!this.swPush.isEnabled || !this.endpoint) return;
    // Must be sent synchronously: the session (token) is cleared right after this hook starts.
    const request = firstValueFrom(this.http.delete(`${this.api}/push/subscribe`, { body: { endpoint: this.endpoint } }));
    this.endpoint = null;
    this.pushState.set('off');
    await this.swPush.unsubscribe().catch(() => undefined);
    await request.catch(() => undefined);
  }

  private async computePushState(): Promise<PushState> {
    const iosNotInstalled = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      && !(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone);
    if (iosNotInstalled) return 'needs-install'; // iOS only allows push for apps added to the home screen
    if (!this.swPush.isEnabled || typeof Notification === 'undefined' || !('PushManager' in window)) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    const sub = await firstValueFrom(this.swPush.subscription).catch(() => null);
    return sub ? 'on' : 'off';
  }
}
