import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PwaService } from '../../../core/services/pwa.service';

/** "New version" toast and the invitation to install the app on a phone. */
@Component({
  selector: 'app-pwa-banners',
  standalone: true,
  imports: [RouterModule],
  template: `
    @if (pwa.updateReady()) {
      <div class="pwa-toast update no-print" role="status">
        <span>✨ Une nouvelle version de l’application est prête.</span>
        <button type="button" class="btn btn-sm btn-primary-gold" (click)="pwa.applyUpdate()">Mettre à jour</button>
      </div>
    } @else if (pwa.showInstallBanner() && pwa.platform !== 'desktop') {
      <div class="pwa-toast install no-print" role="region" aria-label="Installer l’application">
        <img src="icons/icon-192.png" alt="" width="40" height="40" />
        <span class="install-text">
          <strong>Installez l’application</strong>
          <small>Accès en un geste et notifications des devoirs.</small>
        </span>
        @if (pwa.canPrompt()) {
          <button type="button" class="btn btn-sm btn-primary-gold" (click)="install()">Installer</button>
        } @else {
          <a routerLink="/pwa-install" class="btn btn-sm btn-primary-gold">Comment ?</a>
        }
        <button type="button" class="close" (click)="pwa.dismissBanner()" aria-label="Plus tard">✕</button>
      </div>
    }
  `,
  styles: [`
    .pwa-toast {
      position: fixed;
      z-index: 70;
      inset-inline: 0.75rem;
      bottom: calc(4.6rem + env(safe-area-inset-bottom));
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.7rem 0.8rem;
      background: #fff;
      border: 1.5px solid var(--gold-300);
      border-radius: 1rem;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
      animation: rise 0.25s ease-out;
    }
    @media (min-width: 769px) {
      .pwa-toast { inset-inline: auto 1.5rem; bottom: 1.5rem; max-width: 26rem; }
    }
    .pwa-toast img { border-radius: 0.6rem; flex-shrink: 0; }
    .install-text { display: flex; flex-direction: column; flex: 1; min-width: 0; font-size: 0.9rem; }
    .install-text small { color: var(--slate-500); }
    .update span { flex: 1; font-size: 0.9rem; font-weight: 700; }
    .close { border: none; background: transparent; font-size: 1rem; color: var(--slate-400); cursor: pointer; padding: 0.4rem; }
    @keyframes rise { from { transform: translateY(1rem); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .pwa-toast { animation: none; } }
  `]
})
export class PwaBannersComponent {
  readonly pwa = inject(PwaService);

  async install(): Promise<void> {
    if (!(await this.pwa.promptInstall())) this.pwa.dismissBanner();
  }
}
