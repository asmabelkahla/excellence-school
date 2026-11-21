import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { GoogleSignInService } from '../../../core/services/google-sign-in.service';
import { ActivatedRoute, Router } from '@angular/router';
import { I18nService } from '../../../core/services/i18n.service';
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
export class RegisterComponent implements OnInit, AfterViewInit {
  private readonly googleSignIn = inject(GoogleSignInService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  @ViewChild('googleBtn') googleBtn?: ElementRef<HTMLElement>;
  readonly googleReady = signal(false);
  /** Verified Google profile: name / email / password are then not asked. */
  readonly google = signal<{ email: string; fullName: string } | null>(null);
  readonly registeredWithGoogle = signal(false);

  private readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  /** Real classes from the API (not the demo data). */
  readonly classes = signal<{ id: string; name: string }[]>([]);

  async ngOnInit(): Promise<void> {
    const pending = this.route.snapshot.queryParamMap.has('google') ? this.auth.pendingGoogleSignup() : null;
    if (pending) this.google.set({ email: pending.email, fullName: pending.fullName });
    this.classes.set(await this.auth.publicClasses());
  }

  ngAfterViewInit(): void {
    void this.drawGoogleButton();
  }

  /** Back to the email / password form. */
  cancelGoogle(): void {
    this.auth.clearGoogleSignup();
    this.google.set(null);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    setTimeout(() => void this.drawGoogleButton()); // the button container is re-created
  }

  private async drawGoogleButton(): Promise<void> {
    if (!this.googleBtn || this.google()) return;
    this.googleReady.set(await this.googleSignIn.renderButton(this.googleBtn.nativeElement, c => void this.onGoogle(c), 'signup_with'));
  }

  private async onGoogle(credential: string): Promise<void> {
    this.errorMessage.set('');
    this.loading.set(true);
    try {
      const result = await this.auth.googleSignIn(credential);
      if (result.status === 'signed_in') {
        // Already registered and validated: go straight in.
        await this.router.navigateByUrl(this.auth.homeUrlFor(result.user.role));
        return;
      }
      const pending = this.auth.pendingGoogleSignup();
      if (pending) this.google.set({ email: pending.email, fullName: pending.fullName });
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Connexion Google impossible.');
    } finally {
      this.loading.set(false);
    }
  }

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
    return { firstName: '', lastName: '', classId: '' };
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

    if (this.google()) {
      if (!this.phone.trim()) { this.errorMessage.set('Veuillez renseigner votre téléphone.'); return; }
      if (validChildren.length === 0) { this.errorMessage.set('Veuillez renseigner au moins un enfant (prénom et nom).'); return; }
      this.loading.set(true);
      try {
        const message = await this.auth.googleRegister({ phone: this.phone, relationship: this.relationship, children: validChildren });
        this.registeredWithGoogle.set(true);
        this.successMessage.set(message);
      } catch (error) {
        this.errorMessage.set(error instanceof Error ? error.message : 'Une erreur est survenue lors de l’inscription.');
      } finally {
        this.loading.set(false);
      }
      return;
    }

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
