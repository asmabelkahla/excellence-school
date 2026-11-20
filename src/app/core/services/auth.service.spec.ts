import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthService } from './auth.service';
import { SchoolDataService } from './school-data.service';
import { Student, UserProfile } from '../models/school.model';

/** Builds an unsigned JWT-shaped token whose payload expires in `secondsFromNow`. */
function fakeJwt(secondsFromNow: number): string {
  const payload = btoa(JSON.stringify({ sub: 'usr-parent-1', role: 'parent', exp: Math.floor(Date.now() / 1000) + secondsFromNow }));
  return `header.${payload}.signature`;
}

describe('AuthService', () => {
  let auth: AuthService;
  let schoolData: SchoolDataService;
  let http: HttpTestingController;
  let router: { navigate: jasmine.Spy; navigateByUrl: jasmine.Spy };

  function setup() {
    router = { navigate: jasmine.createSpy('navigate'), navigateByUrl: jasmine.createSpy('navigateByUrl') };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });
    auth = TestBed.inject(AuthService);
    schoolData = TestBed.inject(SchoolDataService);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();
    setup();
  });

  afterEach(() => http.verify());

  describe('authentication', () => {
    it('starts signed out: no implicit admin session', () => {
      expect(auth.currentUser()).toBeNull();
      expect(auth.isAuthenticated()).toBeFalse();
    });

    it('signs in through the API and stores the token, never the password', async () => {
      const promise = auth.login('parent@excellence.tn', 'Parent123!');
      const req = http.expectOne(`${environment.apiUrl}/auth/login`);
      expect(req.request.body).toEqual({ identifier: 'parent@excellence.tn', password: 'Parent123!' });
      req.flush({
        token: fakeJwt(3600),
        user: { id: 'usr-parent-1', role: 'parent', full_name: 'Asma', email: 'parent@excellence.tn', locale: 'fr', active: true, created_at: '' }
      });
      await new Promise(resolve => setTimeout(resolve));
      http.expectOne(`${environment.apiUrl}/me/children`).flush([]);

      const user = await promise;
      expect(user.role).toBe('parent');
      expect(auth.isAuthenticated()).toBeTrue();
      expect(auth.getToken()).toBeTruthy();
      expect(localStorage.getItem('esm_current_user')).not.toContain('Parent123!');
    });

    it('surfaces the API error message on failed login', async () => {
      const promise = auth.login('x@y.tn', 'wrong');
      http.expectOne(`${environment.apiUrl}/auth/login`).flush(
        { message: 'Identifiant ou mot de passe incorrect.' },
        { status: 401, statusText: 'Unauthorized' }
      );
      await expectAsync(promise).toBeRejectedWithError('Identifiant ou mot de passe incorrect.');
      expect(auth.isAuthenticated()).toBeFalse();
    });

    it('ignores an expired cached session', () => {
      localStorage.setItem('esm_token', fakeJwt(-10));
      localStorage.setItem('esm_current_user', JSON.stringify({ id: 'usr-parent-1', role: 'parent', full_name: 'A', locale: 'fr' }));
      TestBed.resetTestingModule();
      setup();
      expect(auth.isAuthenticated()).toBeFalse();
      expect(localStorage.getItem('esm_token')).toBeNull();
    });

    it('adds the bearer token to API calls and signs out on 401', async () => {
      localStorage.setItem('esm_token', fakeJwt(3600));
      localStorage.setItem('esm_current_user', JSON.stringify({ id: 'usr-parent-1', role: 'parent', full_name: 'A', locale: 'fr' }));
      TestBed.resetTestingModule();
      setup();
      expect(auth.isAuthenticated()).toBeTrue();

      const refresh = auth.refreshSession();
      const req = http.expectOne(`${environment.apiUrl}/auth/me`);
      expect(req.request.headers.get('Authorization')).toMatch(/^Bearer /);
      req.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });
      await refresh;

      expect(auth.isAuthenticated()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: 1 } });
    });
  });

  describe('parent registration', () => {
    it('posts the registration and does not sign the parent in (pending approval)', async () => {
      const promise = auth.registerParent({
        fullName: 'Maya Dakhli',
        phone: '+216 98 111 222',
        email: 'Maya@Test.tn',
        password: 'Secret123',
        relationship: 'mere',
        children: [{ firstName: 'Ali', lastName: 'Dakhli', classId: 'cls-3a' }]
      });

      const req = http.expectOne(`${environment.apiUrl}/auth/register`);
      expect(req.request.body.email).toBe('maya@test.tn');
      expect(req.request.body.children[0].className).toBe('3ème A');
      req.flush({ user: { id: 'usr-parent-x', role: 'parent', active: false }, message: 'En attente de validation.' });

      expect(await promise).toBe('En attente de validation.');
      expect(auth.isAuthenticated()).toBeFalse();
    });
  });

  describe('local school data', () => {
    /** Puts a user in the local store (the profile screens still read it). */
    function addLocalUser(fields: Partial<UserProfile> & { id: string; role: UserProfile['role']; full_name: string }): UserProfile {
      const user = { locale: 'fr', active: true, created_at: '', ...fields } as UserProfile;
      schoolData.users.update(list => [...list, user]);
      return user;
    }

    it('never persists passwords to localStorage', () => {
      addLocalUser({ id: 'usr-p', role: 'parent', full_name: 'P', email: 'p@x.tn', password: 'Secret123!' });
      schoolData.saveToStorage();
      expect(localStorage.getItem('esm_school_data_v1')).not.toContain('Secret123!');
    });

    it('shows only the children validated by the school (from the API), never local demo links', async () => {
      const promise = auth.login('parent@excellence.tn', 'Parent123!');
      http.expectOne(`${environment.apiUrl}/auth/login`).flush({
        token: fakeJwt(3600),
        // usr-parent-1 has two children in the local demo data: they must not show up.
        user: { id: 'usr-parent-1', role: 'parent', full_name: 'Asma', locale: 'fr', active: true, created_at: '' }
      });
      await new Promise(resolve => setTimeout(resolve));
      http.expectOne(`${environment.apiUrl}/me/children`).flush([
        { id: 'std-api-1', first_name: 'Yakine', last_name: 'Chaabane', class_id: 'cls-2a', class_name: '2ème A', relationship: 'mere' }
      ]);
      await promise;

      expect(auth.parentChildren().map(c => c.id)).toEqual(['std-api-1']);
      expect(auth.selectedStudent()?.id).toBe('std-api-1');
      expect(localStorage.getItem('esm_children')).toContain('std-api-1');

      auth.logout();
      expect(auth.parentChildren()).toEqual([]);
      expect(localStorage.getItem('esm_children')).toBeNull();
    });

    it('does not load children before a provisional password is changed', async () => {
      const promise = auth.login('parent@excellence.tn', 'Tmp4xYz9Qa2b');
      http.expectOne(`${environment.apiUrl}/auth/login`).flush({
        token: fakeJwt(3600),
        user: { id: 'usr-parent-9', role: 'parent', full_name: 'P', locale: 'fr', active: true, created_at: '', must_change_password: true }
      });
      await promise;
      http.expectNone(`${environment.apiUrl}/me/children`);
    });

    it('allows admin to create and update levels', () => {
      const created = schoolData.addLevel({
        code: '6eme',
        name_fr: '6ème année',
        name_ar: 'السنة السادسة',
        position: 6
      });
  
      expect(created.id).toBeTruthy();
      expect(schoolData.levels().some(l => l.code === '6eme')).toBeTrue();
  
      const updated = schoolData.updateLevel(created.id, { name_fr: '6e année' });
      expect(updated?.name_fr).toBe('6e année');
    });
  
    it('scopes parent data to the selected child class when student-specific records are absent', () => {
      const child = { id: 'std-scope-test', first_name: 'Sami', last_name: 'Scope', class_id: 'cls-3a', class_name: '3ème A' } as Student;

      const childHomework = schoolData.getStudentScopedHomework(child);
      const childTimetable = schoolData.getStudentScopedTimetable(child);
  
      expect(childHomework.length).toBeGreaterThan(0);
      expect(childTimetable.length).toBeGreaterThan(0);
      expect(childHomework.every(hw => hw.class_id === child.class_id)).toBeTrue();
      expect(childTimetable.every(slot => slot.class_id === child.class_id)).toBeTrue();
    });
  
    it('updates the current user profile and settings', () => {
      const parent = addLocalUser({ id: 'usr-p1', role: 'parent', full_name: 'Asma Belkahla', email: 'asma.updated@excellence.tn' });
      auth.setUser(parent);
  
      auth.updateCurrentUserProfile({
        full_name: 'Asma Belkahla Updated',
        phone: '+216 98 111 000',
        email: 'asma.updated@excellence.tn'
      });
  
      auth.updateCurrentUserSettings({
        locale: 'ar',
        notificationsEnabled: false
      });
  
      const saved = schoolData.users().find(u => u.id === parent.id)!;
      expect(saved.full_name).toBe('Asma Belkahla Updated');
      expect(saved.phone).toBe('+216 98 111 000');
      expect(saved.email).toBe('asma.updated@excellence.tn');
      expect(saved.locale).toBe('ar');
      expect(auth.currentUser()?.locale).toBe('ar');
    });
  
    it('persists parent profile and settings in the session storage', () => {
      const parent = addLocalUser({ id: 'usr-p2', role: 'parent', full_name: 'Asma Belkahla Parent', email: 'asma.parent.updated@excellence.tn' });
      auth.setUser(parent);
  
      auth.updateCurrentUserProfile({
        full_name: 'Asma Belkahla Parent Updated',
        phone: '+216 98 000 111',
        email: 'asma.parent.updated@excellence.tn'
      });
  
      auth.updateCurrentUserSettings({
        locale: 'ar',
        notificationsEnabled: false
      });
  
      const persisted = JSON.parse(localStorage.getItem('esm_current_user') || '{}');
      expect(persisted.full_name).toBe('Asma Belkahla Parent Updated');
      expect(persisted.locale).toBe('ar');
      expect(persisted.notifications_enabled).toBeFalse();
      expect(auth.currentUser()?.notifications_enabled).toBeFalse();
    });
  
  });
});
