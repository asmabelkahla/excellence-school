import { Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Chrome / Edge / Android's install event (not in the standard DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'android' | 'ios' | 'desktop';

const DISMISS_KEY = 'esm_install_banner_dismissed';

/**
 * Everything about running as an installed app:
 * - captures the browser's install prompt (it fires once, early, so this service is created at start-up);
 * - knows when the app already runs installed (standalone);
 * - tells when a new version has been downloaded by the service worker.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly swUpdate = inject(SwUpdate);
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly canPrompt = signal(false);
  readonly installed = signal(this.detectStandalone());
  readonly updateReady = signal(false);
  readonly bannerDismissed = signal(this.readDismissed());

  readonly platform: InstallPlatform = this.detectPlatform();
  readonly isIos = this.platform === 'ios';
  /** iOS only installs from Safari ("Add to Home Screen"); other iOS browsers cannot. */
  readonly isIosNonSafari = this.isIos && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);

  /** Show the install invitation: not installed, not dismissed, and installable here. */
  readonly showInstallBanner = computed(() =>
    !this.installed() && !this.bannerDismissed() && (this.canPrompt() || this.isIos));

  constructor() {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault(); // we show our own button instead of the mini-infobar
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.canPrompt.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canPrompt.set(false);
      this.installed.set(true);
    });
    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', e => this.installed.set(e.matches));

    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => this.updateReady.set(true));
      // Phones keep the app open for days: look for updates every 30 minutes.
      setInterval(() => void this.swUpdate.checkForUpdate().catch(() => undefined), 30 * 60 * 1000);
    }
  }

  /** Opens the native install dialog (Android / Chrome / Edge). Returns true if accepted. */
  async promptInstall(): Promise<boolean> {
    const prompt = this.deferredPrompt;
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    this.deferredPrompt = null; // a prompt can be used only once
    this.canPrompt.set(false);
    return outcome === 'accepted';
  }

  dismissBanner(): void {
    this.bannerDismissed.set(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // storage unavailable: dismiss for this session only
    }
  }

  /** Switches to the downloaded version. */
  async applyUpdate(): Promise<void> {
    try {
      await this.swUpdate.activateUpdate();
    } finally {
      document.location.reload();
    }
  }

  private detectStandalone(): boolean {
    return window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  }

  private detectPlatform(): InstallPlatform {
    const ua = navigator.userAgent;
    // iPadOS 13+ reports itself as a Mac: detect it by touch support.
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  }

  /** The invitation comes back 14 days after being dismissed. */
  private readDismissed(): boolean {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY));
      return !!at && Date.now() - at < 14 * 24 * 3600 * 1000;
    } catch {
      return false;
    }
  }
}
