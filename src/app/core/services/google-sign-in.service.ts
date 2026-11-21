import { Injectable, NgZone, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { I18nService } from './i18n.service';

/** Minimal typing of Google Identity Services (https://accounts.google.com/gsi/client). */
interface GoogleAccounts {
  id: {
    initialize(config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; auto_select?: boolean; cancel_on_tap_outside?: boolean; use_fedcm_for_prompt?: boolean }): void;
    renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
    disableAutoSelect(): void;
  };
}
declare global {
  interface Window { google?: { accounts: GoogleAccounts }; }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/**
 * Loads Google's official sign-in script once and draws the "Continue with Google" button.
 * Nothing is shown when the API has no GOOGLE_CLIENT_ID.
 */
@Injectable({ providedIn: 'root' })
export class GoogleSignInService {
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);
  private readonly i18n = inject(I18nService);
  private script?: Promise<void>;
  private clientId?: Promise<string | null>;
  private onCredential?: (credential: string) => void;

  constructor() {
    // Shared phone: after sign-out, Google must not silently sign the next person in.
    this.auth.onLogout(() => this.disableAutoSelect());
  }

  /** Returns false when Google sign-in is not configured or the script cannot load. */
  async renderButton(container: HTMLElement, onCredential: (credential: string) => void, text: 'continue_with' | 'signup_with' = 'continue_with'): Promise<boolean> {
    const clientId = await (this.clientId ??= this.auth.googleClientId());
    if (!clientId) return false;
    try {
      await (this.script ??= this.loadScript());
    } catch {
      this.script = undefined;
      return false;
    }
    const google = window.google;
    if (!google) return false;

    this.onCredential = onCredential;
    google.accounts.id.initialize({
      client_id: clientId,
      // Google calls back outside Angular: re-enter the zone so the screen updates.
      callback: ({ credential }) => this.zone.run(() => this.onCredential?.(credential)),
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true
    });
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text,
      // Same language as the app (Google would otherwise guess from the browser).
      locale: this.i18n.currentLocale() === 'ar' ? 'ar' : 'fr',
      logo_alignment: 'center',
      width: Math.min(400, Math.max(240, container.clientWidth || 320))
    });
    return true;
  }

  /** After sign-out: do not silently sign the next person in with the same Google account. */
  disableAutoSelect(): void {
    window.google?.accounts.id.disableAutoSelect();
  }

  private loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) return resolve();
      const el = document.createElement('script');
      el.src = SCRIPT_URL;
      el.async = true;
      el.defer = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('Google script unavailable'));
      document.head.appendChild(el);
    });
  }
}
