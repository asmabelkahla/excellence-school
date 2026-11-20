import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserProfile, UserRole, Student } from '../models/school.model';
import { SchoolDataService } from './school-data.service';
import { I18nService, Locale } from './i18n.service';

const TOKEN_KEY = 'esm_token';
const USER_KEY = 'esm_current_user';
const NOTIFICATIONS_KEY = 'esm_notifications_enabled';
const CHILDREN_KEY = 'esm_children';
const SELECTED_CHILD_KEY = 'esm_selected_child';

/** A child validated by the school for the signed-in parent (from `GET /me/children`). */
export type LinkedChild = Student & { relationship?: string };

interface AuthResponse {
  user: UserProfile;
  token?: string;
  message?: string;
}

export interface ParentRegistration {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  relationship?: 'mere' | 'pere' | 'tuteur';
  children: { firstName: string; lastName: string; classId?: string }[];
}

const HOME_BY_ROLE: Record<UserRole, string> = {
  parent: '/parent/dashboard',
  teacher: '/teacher/classes',
  econome: '/econome/finance',
  moderator: '/moderator/dashboard',
  admin: '/admin/dashboard'
};

/** Turns any API / network error into a message a user can read. */
export function readableApiError(error: unknown, fallback = 'Une erreur est survenue. Réessayez.'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 504 || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      // 504 is what the service worker answers for API calls while offline.
      return 'Vous êtes hors connexion. Les données s’afficheront dès le retour du réseau.';
    }
    if (error.status === 0) {
      return 'Serveur injoignable. Vérifiez votre connexion internet et réessayez.';
    }
    if (error.status === 429) {
      return 'Trop de tentatives. Patientez une minute avant de réessayer.';
    }
    const message = error.error?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiBase = environment.apiUrl;
  private token: string | null = null;

  readonly currentUser = signal<UserProfile | null>(null);
  readonly currentRole = computed<UserRole | null>(() => this.currentUser()?.role ?? null);
  readonly selectedStudent = signal<Student | null>(null);

  /** Children validated by the school, as returned by the API (cached for offline start-up). */
  private readonly linkedChildren = signal<LinkedChild[]>([]);
  readonly childrenLoading = signal(false);
  readonly childrenError = signal<string | null>(null);

  /** Children linked to the signed-in parent. */
  readonly parentChildren = computed<LinkedChild[]>(() =>
    this.currentUser()?.role === 'parent' ? this.linkedChildren() : []
  );

  constructor(
    private http: HttpClient,
    private schoolData: SchoolDataService,
    private router: Router,
    private i18n: I18nService
  ) {
    this.restoreCachedSession();
  }

  // ------------------------------------------------------------------ session

  getToken(): string | null {
    if (this.token && this.isTokenExpired(this.token)) {
      this.clearSession();
    }
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.currentUser();
  }

  homeUrlFor(role: UserRole): string {
    return HOME_BY_ROLE[role] ?? '/login';
  }

  /** Restores the session saved in this browser, only if its JWT is still valid. */
  private restoreCachedSession() {
    // Clean up keys written by older versions of the app (plain-text passwords, DB credentials).
    ['esm_current_user_id', 'esm_google_email', 'esm_google_name', 'esm_postgres_url', 'esm_postgres_user', 'esm_postgres_password']
      .forEach(key => localStorage.removeItem(key));

    const token = localStorage.getItem(TOKEN_KEY);
    const cachedUser = localStorage.getItem(USER_KEY);
    if (!token || !cachedUser || this.isTokenExpired(token)) {
      this.clearSession();
      return;
    }

    try {
      this.token = token;
      const cachedChildren = localStorage.getItem(CHILDREN_KEY);
      if (cachedChildren) this.linkedChildren.set(JSON.parse(cachedChildren) as LinkedChild[]);
      this.setUser(JSON.parse(cachedUser) as UserProfile);
    } catch {
      this.clearSession();
    }
  }

  /**
   * Re-validates the cached session against the API (called once at startup).
   * A 401 is handled by the interceptor, which signs the user out.
   */
  async refreshSession(): Promise<void> {
    if (!this.getToken()) return;
    try {
      const user = await firstValueFrom(this.http.get<UserProfile>(`${this.apiBase}/auth/me`));
      this.setUser({ ...this.currentUser(), ...user });
    } catch {
      // Offline or API down: keep the cached session until the token expires.
      return;
    }
    await this.loadChildren();
  }

  /**
   * Loads the signed-in parent's children from the API. Only children validated
   * by the school are returned: a parent can never add one on their own.
   */
  async loadChildren(): Promise<void> {
    const user = this.currentUser();
    if (user?.role !== 'parent' || user.must_change_password) return;
    this.childrenLoading.set(true);
    this.childrenError.set(null);
    try {
      const children = await firstValueFrom(this.http.get<LinkedChild[]>(`${this.apiBase}/me/children`));
      this.linkedChildren.set(children);
      localStorage.setItem(CHILDREN_KEY, JSON.stringify(children));
      this.syncSelectedStudent();
    } catch (error) {
      this.childrenError.set(readableApiError(error, 'Impossible de charger vos enfants.'));
    } finally {
      this.childrenLoading.set(false);
    }
  }

  /** Keeps the selected child valid (and remembered across reloads). */
  private syncSelectedStudent(): void {
    const children = this.parentChildren();
    const current = this.selectedStudent();
    const rememberedId = current?.id ?? localStorage.getItem(SELECTED_CHILD_KEY);
    const next = children.find(c => c.id === rememberedId) ?? children[0] ?? null;
    this.selectedStudent.set(next);
    if (next) localStorage.setItem(SELECTED_CHILD_KEY, next.id);
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  private clearSession() {
    this.token = null;
    this.currentUser.set(null);
    this.selectedStudent.set(null);
    this.linkedChildren.set([]);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(CHILDREN_KEY);
    localStorage.removeItem(SELECTED_CHILD_KEY);
  }

  private persistCurrentUser(user: UserProfile) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;
    localStorage.setItem(USER_KEY, JSON.stringify(safeUser));
    localStorage.setItem(NOTIFICATIONS_KEY, String(user.notifications_enabled !== false));
  }

  setUser(user: UserProfile) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;
    const normalizedUser: UserProfile = {
      ...safeUser,
      locale: user.locale === 'ar' ? 'ar' : 'fr',
      notifications_enabled: user.notifications_enabled ?? (localStorage.getItem(NOTIFICATIONS_KEY) !== 'false')
    };

    // Keep the local data store in sync so profile-dependent views keep working.
    this.schoolData.users.update(list =>
      list.some(u => u.id === normalizedUser.id)
        ? list.map(u => (u.id === normalizedUser.id ? { ...u, ...normalizedUser } : u))
        : [...list, normalizedUser]
    );

    this.currentUser.set(normalizedUser);
    this.persistCurrentUser(normalizedUser);
    this.i18n.setLocale(normalizedUser.locale);

    if (normalizedUser.role === 'parent') {
      this.syncSelectedStudent();
    }
  }

  // --------------------------------------------------------------- auth flows

  /** Signs in against the API. Throws an Error with a user-facing message on failure. */
  async login(identifier: string, password: string): Promise<UserProfile> {
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.apiBase}/auth/login`, {
          identifier: identifier.trim(),
          password
        })
      );
      if (!response.token || !response.user) {
        throw new Error('Réponse inattendue du serveur.');
      }

      this.token = response.token;
      localStorage.setItem(TOKEN_KEY, response.token);
      this.linkedChildren.set([]);
      this.selectedStudent.set(null);
      this.setUser(response.user);
      await this.loadChildren();
      return response.user;
    } catch (error) {
      throw new Error(readableApiError(error, 'Identifiant ou mot de passe incorrect.'));
    }
  }

  /**
   * Changes the signed-in user's password. The API closes every other session
   * and returns a fresh token for this one.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.apiBase}/auth/change-password`, { currentPassword, newPassword })
      );
      if (response.token) {
        this.token = response.token;
        localStorage.setItem(TOKEN_KEY, response.token);
      }
      const user = this.currentUser();
      if (user) this.setUser({ ...user, ...response.user, must_change_password: false });
      await this.loadChildren();
    } catch (error) {
      throw new Error(readableApiError(error, 'Le mot de passe n’a pas pu être modifié.'));
    }
  }

  /** Called when the API says the password must be changed first. */
  markPasswordChangeRequired(): void {
    const user = this.currentUser();
    if (user && !user.must_change_password) this.setUser({ ...user, must_change_password: true });
  }

  /** Parent self-registration. The account stays inactive until an admin validates it. */
  async registerParent(data: ParentRegistration): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.apiBase}/auth/register`, {
          fullName: data.fullName.trim(),
          phone: data.phone.trim(),
          email: data.email.trim().toLowerCase(),
          password: data.password,
          relationship: data.relationship,
          children: data.children.map(child => ({
            firstName: child.firstName.trim(),
            lastName: child.lastName.trim(),
            classId: child.classId,
            className: this.schoolData.classes().find(c => c.id === child.classId)?.name
          }))
        })
      );
      return response.message ?? 'Votre demande a bien été enregistrée.';
    } catch (error) {
      throw new Error(readableApiError(error, 'L’inscription a échoué. Vérifiez les informations et réessayez.'));
    }
  }

  private readonly logoutHooks: (() => Promise<void> | void)[] = [];

  /** Work to do while the session is still valid, just before signing out (e.g. unregister push). */
  onLogout(hook: () => Promise<void> | void): void {
    this.logoutHooks.push(hook);
  }

  logout(options: { expired?: boolean } = {}) {
    // Hooks get a short head start with the token still set; an expired session skips them.
    if (!options.expired) {
      for (const hook of this.logoutHooks) {
        try { void Promise.resolve(hook()).catch(() => undefined); } catch { /* never block sign-out */ }
      }
    }
    this.clearSession();
    this.router.navigate(['/login'], options.expired ? { queryParams: { expired: 1 } } : {});
  }

  navigateForRole(role: UserRole) {
    this.router.navigateByUrl(this.homeUrlFor(role));
  }

  // ------------------------------------------------------- profile & children

  selectStudent(student: Student) {
    this.selectedStudent.set(student);
    localStorage.setItem(SELECTED_CHILD_KEY, student.id);
  }

  updateCurrentUserProfile(updates: Partial<UserProfile>): UserProfile | null {
    const user = this.currentUser();
    if (!user) {
      return null;
    }

    const email = updates.email?.trim() || user.email || '';
    if (email) {
      const duplicate = this.schoolData.users().find(existing => existing.id !== user.id && existing.email?.toLowerCase() === email.toLowerCase());
      if (duplicate) {
        throw new Error('Cet email est déjà utilisé par un autre utilisateur.');
      }
    }

    const nextUser: UserProfile = {
      ...user,
      full_name: updates.full_name?.trim() || user.full_name,
      phone: updates.phone?.trim() || user.phone || '',
      email: email || user.email,
      avatar_url: updates.avatar_url || user.avatar_url || 'assets/avatars/default.png',
      locale: updates.locale || user.locale,
      notifications_enabled: updates.notifications_enabled ?? user.notifications_enabled ?? true
    };

    this.setUser(nextUser);
    this.schoolData.saveToStorage();
    return nextUser;
  }

  updateCurrentUserSettings(settings: { locale?: Locale; notificationsEnabled?: boolean }): UserProfile | null {
    const user = this.currentUser();
    if (!user) {
      return null;
    }

    const nextUser: UserProfile = {
      ...user,
      locale: settings.locale || user.locale,
      notifications_enabled: settings.notificationsEnabled ?? user.notifications_enabled ?? true
    };

    this.setUser(nextUser);
    this.schoolData.saveToStorage();
    return nextUser;
  }

  // ------------------------------------------------------------- role helpers

  isParent(): boolean {
    return this.currentRole() === 'parent';
  }

  isTeacher(): boolean {
    return this.currentRole() === 'teacher';
  }

  isEconome(): boolean {
    return this.currentRole() === 'econome';
  }

  isModerator(): boolean {
    return this.currentRole() === 'moderator';
  }

  isAdmin(): boolean {
    return this.currentRole() === 'admin';
  }
}
