import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { AuthBrandPanelComponent } from '../auth-brand-panel.component';

interface ChildInput {
  firstName: string;
  lastName: string;
  classId: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterModule, AuthBrandPanelComponent],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  readonly schoolData = inject(SchoolDataService);

  fullName = '';
  phone = '';
  email = '';
  password = '';
  confirmPassword = '';
  relationship: 'mere' | 'pere' | 'tuteur' = 'mere';
  children: ChildInput[] = [this.emptyChild()];

  readonly submitted = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  private emptyChild(): ChildInput {
    return { firstName: '', lastName: '', classId: this.schoolData.classes()[0]?.id ?? '' };
  }

  get emailInvalid() { return !EMAIL_PATTERN.test(this.email.trim()); }
  get passwordInvalid() { return !PASSWORD_PATTERN.test(this.password); }
  get confirmInvalid() { return this.password !== this.confirmPassword; }

  addChildField() {
    if (this.children.length < 10) {
      this.children.push(this.emptyChild());
    }
  }

  removeChildField(index: number) {
    if (this.children.length > 1) {
      this.children.splice(index, 1);
    }
  }

  async onSubmit() {
    if (this.loading()) return;
    this.submitted.set(true);
    this.errorMessage.set('');

    const validChildren = this.children.filter(child => child.firstName.trim() && child.lastName.trim());

    if (!this.fullName.trim() || !this.phone.trim()) {
      this.errorMessage.set('Veuillez renseigner votre nom et votre téléphone.');
      return;
    }
    if (this.emailInvalid) {
      this.errorMessage.set('Veuillez saisir une adresse email valide.');
      return;
    }
    if (this.passwordInvalid) {
      this.errorMessage.set(this.i18n.t('passwordHint'));
      return;
    }
    if (this.confirmInvalid) {
      this.errorMessage.set('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (validChildren.length === 0) {
      this.errorMessage.set('Veuillez renseigner au moins un enfant (prénom et nom).');
      return;
    }

    this.loading.set(true);
    try {
      const message = await this.auth.registerParent({
        fullName: this.fullName,
        phone: this.phone,
        email: this.email,
        password: this.password,
        relationship: this.relationship,
        children: validChildren
      });
      this.successMessage.set(message);
      this.password = '';
      this.confirmPassword = '';
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Une erreur est survenue lors de l’inscription.');
    } finally {
      this.loading.set(false);
    }
  }
}
