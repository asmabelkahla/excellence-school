import { Component, inject } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';

/** Left-hand brand panel shared by the login and register pages (hidden on mobile). */
@Component({
  selector: 'app-auth-brand-panel',
  standalone: true,
  host: { class: 'auth-brand', role: 'complementary' },
  template: `
    <div class="auth-brand-head">
      <img src="assets/logo-excellence-school-monastir.jpg" alt="" />
      <div>
        <strong>{{ i18n.t('appName') }}</strong>
        <span>{{ i18n.t('schoolSubtitle') }}</span>
      </div>
    </div>

    <div class="auth-brand-body">
      <h2>{{ i18n.t('brandTagline') }}</h2>
      <ul>
        <li><span class="feature-icon" aria-hidden="true">📊</span>{{ i18n.t('featureGrades') }}</li>
        <li><span class="feature-icon" aria-hidden="true">📚</span>{{ i18n.t('featureHomework') }}</li>
        <li><span class="feature-icon" aria-hidden="true">💳</span>{{ i18n.t('featureFees') }}</li>
      </ul>
    </div>

    <div class="auth-brand-foot">© {{ year }} {{ i18n.t('appName') }} · {{ i18n.t('monastirTunisia') }}</div>
  `
})
export class AuthBrandPanelComponent {
  readonly i18n = inject(I18nService);
  readonly year = new Date().getFullYear();
}
