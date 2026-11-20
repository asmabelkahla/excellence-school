import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { AuthBrandPanelComponent } from '../auth-brand-panel.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule, AuthBrandPanelComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
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
}
