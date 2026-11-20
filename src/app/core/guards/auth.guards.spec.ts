import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { UserProfile, UserRole } from '../models/school.model';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard, passwordChangeGuard, roleGuard } from './auth.guards';

describe('auth guards', () => {
  let auth: AuthService;
  let router: Router;

  const routeWithRoles = (roles: UserRole[]) => ({ data: { roles } }) as unknown as ActivatedRouteSnapshot;
  const state = { url: '/admin/dashboard' } as RouterStateSnapshot;
  const run = <T>(fn: () => T) => TestBed.runInInjectionContext(fn);

  function signInAs(role: UserRole) {
    spyOn(auth, 'isAuthenticated').and.returnValue(true);
    auth.currentUser.set({ id: `usr-${role}`, role, full_name: role, locale: 'fr', created_at: '' } as UserProfile);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('authGuard redirects visitors to /login with a returnUrl', () => {
    const result = run(() => authGuard(routeWithRoles([]), state)) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/login?returnUrl=%2Fadmin%2Fdashboard');
  });

  it('authGuard lets signed-in users through', () => {
    signInAs('parent');
    expect(run(() => authGuard(routeWithRoles([]), state))).toBeTrue();
  });

  it('roleGuard blocks a parent from admin pages and sends them home', () => {
    signInAs('parent');
    const result = run(() => roleGuard(routeWithRoles(['admin']), state)) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/parent/dashboard');
  });

  it('roleGuard allows a matching role', () => {
    signInAs('admin');
    expect(run(() => roleGuard(routeWithRoles(['admin']), state))).toBeTrue();
  });

  it('guestGuard redirects signed-in users away from /login', () => {
    signInAs('teacher');
    const result = run(() => guestGuard({} as any, [])) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/teacher/classes');
  });

  it('passwordChangeGuard sends a user with a provisional password to /change-password', () => {
    signInAs('teacher');
    auth.currentUser.update(u => ({ ...u!, must_change_password: true }));
    const result = run(() => passwordChangeGuard(routeWithRoles([]), state)) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/change-password');
  });

  it('passwordChangeGuard lets other users through', () => {
    signInAs('teacher');
    expect(run(() => passwordChangeGuard(routeWithRoles([]), state))).toBeTrue();
  });
});
