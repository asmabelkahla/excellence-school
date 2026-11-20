import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { AuthBrandPanelComponent } from '../auth-brand-panel.component';

const STRONG = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

/**
 * Forced after an admin created the account / reset the password,
 * and also reachable from the profile menu for a voluntary change.
 */
@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule, AuthBrandPanelComponent],
  templateUrl: './change-password.component.html'
})
export class ChangePasswordComponent {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly forced = computed(() => !!this.auth.currentUser()?.must_change_password);
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly showPasswords = signal(false);
  submitted = false;

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  get weak(): boolean { return !STRONG.test(this.newPassword); }
  get mismatch(): boolean { return this.newPassword !== this.confirmPassword; }

  async onSubmit(): Promise<void> {
    if (this.loading()) return;
    this.submitted = true;
    this.errorMsg.set('');
    if (!this.currentPassword) return;
    if (this.weak) { this.errorMsg.set(this.i18n.t('passwordTooWeak')); return; }
    if (this.mismatch) { this.errorMsg.set(this.i18n.t('passwordsDontMatch')); return; }

    this.loading.set(true);
    try {
      await this.auth.changePassword(this.currentPassword, this.newPassword);
      const role = this.auth.currentUser()?.role;
      await this.router.navigateByUrl(role ? this.auth.homeUrlFor(role) : '/login');
    } catch (error) {
      this.errorMsg.set(error instanceof Error ? error.message : 'Erreur inattendue.');
    } finally {
      this.loading.set(false);
    }
  }

  cancel(): void {
    const role = this.auth.currentUser()?.role;
    void this.router.navigateByUrl(role ? this.auth.homeUrlFor(role) : '/login');
  }
}
