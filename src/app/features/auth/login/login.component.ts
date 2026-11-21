import { AfterViewInit, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { GoogleSignInService } from '../../../core/services/google-sign-in.service';
import { I18nService } from '../../../core/services/i18n.service';
import { AuthBrandPanelComponent } from '../auth-brand-panel.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule, AuthBrandPanelComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements AfterViewInit {
  private readonly googleSignIn = inject(GoogleSignInService);
  @ViewChild('googleBtn') googleBtn?: ElementRef<HTMLElement>;
  /** True once the Google button is drawn (API has a GOOGLE_CLIENT_ID). */
  readonly googleReady = signal(false);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly i18n = inject(I18nService);

  identifier = '';
  password = '';
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly sessionExpired = this.route.snapshot.queryParamMap.has('expired');

  async onSubmit() {
    if (this.loading()) return;
    this.errorMsg.set('');

    if (!this.identifier.trim() || !this.password) {
      this.errorMsg.set(this.i18n.t('requiredFields'));
      return;
    }

    this.loading.set(true);
    try {
      const user = await this.auth.login(this.identifier, this.password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      // Only follow internal return URLs (prevents open redirects).
      const target = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
        ? returnUrl
        : this.auth.homeUrlFor(user.role);
      await this.router.navigateByUrl(target);
    } catch (error) {
      this.errorMsg.set(error instanceof Error ? error.message : 'Connexion impossible.');
      this.password = '';
    } finally {
      this.loading.set(false);
    }
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.googleBtn) return;
    this.googleReady.set(await this.googleSignIn.renderButton(this.googleBtn.nativeElement, credential => void this.onGoogle(credential)));
  }

  private async onGoogle(credential: string): Promise<void> {
    if (this.loading()) return;
    this.errorMsg.set('');
    this.loading.set(true);
    try {
      const result = await this.auth.googleSignIn(credential);
      if (result.status === 'needs_registration') {
        // New parent: complete phone + children on the registration page.
        await this.router.navigate(['/register'], { queryParams: { google: 1 } });
        return;
      }
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const target = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
        ? returnUrl
        : this.auth.homeUrlFor(result.user.role);
      await this.router.navigateByUrl(target);
    } catch (error) {
      this.errorMsg.set(error instanceof Error ? error.message : 'Connexion Google impossible.');
    } finally {
      this.loading.set(false);
    }
  }
}
