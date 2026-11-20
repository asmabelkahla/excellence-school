import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthService } from './auth.service';
import { StaffApiService, StaffMember } from './staff-api.service';

const api = `${environment.apiUrl}/staff`;

const member = (overrides: Partial<StaffMember> = {}): StaffMember => ({
  id: 'usr-teacher-1', role: 'teacher', full_name: 'Mme Salma', email: 'salma@excellence.tn',
  locale: 'fr', active: true, created_at: '', ...overrides
});

describe('StaffApiService', () => {
  let service: StaffApiService;
  let http: HttpTestingController;
  let router: { navigate: jasmine.Spy; navigateByUrl: jasmine.Spy };

  beforeEach(async () => {
    localStorage.clear();
    router = { navigate: jasmine.createSpy('navigate'), navigateByUrl: jasmine.createSpy('navigateByUrl') };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });
    service = TestBed.inject(StaffApiService);
    http = TestBed.inject(HttpTestingController);

    const loading = service.load();
    http.expectOne(api).flush([member(), member({ id: 'usr-eco', role: 'econome', full_name: 'M. Nizar', active: false })]);
    await loading;
  });

  afterEach(() => http.verify());

  it('loads staff and counts only active accounts', () => {
    expect(service.staff().length).toBe(2);
    expect(service.activeCount()).toBe(1);
  });

  it('creates an account without sending any password and returns the one-time password', async () => {
    const promise = service.create({ fullName: '  Ali Ben  ', email: ' Ali@Excellence.TN ', phone: '', role: 'teacher' });
    const req = http.expectOne(api);
    expect(req.request.body).toEqual({ fullName: 'Ali Ben', email: 'ali@excellence.tn', role: 'teacher' });
    expect(Object.keys(req.request.body)).not.toContain('password');
    req.flush({ user: member({ id: 'usr-ali', full_name: 'Ali Ben', must_change_password: true }), temporaryPassword: 'Tmp4xYz9Qa2b' });
    const result = await promise;
    expect(result.temporaryPassword).toBe('Tmp4xYz9Qa2b');
    expect(service.staff().map(s => s.full_name)).toEqual(['Ali Ben', 'M. Nizar', 'Mme Salma']);
  });

  it('deactivates through PATCH and keeps the server answer', async () => {
    const promise = service.update('usr-teacher-1', { active: false });
    const req = http.expectOne(`${api}/usr-teacher-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ active: false });
    req.flush(member({ active: false }));
    await promise;
    expect(service.activeCount()).toBe(0);
  });

  it('marks the account as provisional after a password reset', async () => {
    const promise = service.resetPassword('usr-teacher-1');
    http.expectOne(`${api}/usr-teacher-1/reset-password`).flush({ temporaryPassword: 'New4Pass9xyz' });
    expect(await promise).toBe('New4Pass9xyz');
    expect(service.staff().find(s => s.id === 'usr-teacher-1')!.must_change_password).toBeTrue();
  });

  it('surfaces the API refusal message (e.g. last admin)', async () => {
    const promise = service.update('usr-teacher-1', { role: 'admin' });
    http.expectOne(`${api}/usr-teacher-1`).flush(
      { message: 'Impossible : ce compte est le dernier administrateur actif.' }, { status: 400, statusText: 'Bad Request' });
    await expectAsync(promise).toBeRejectedWithError('Impossible : ce compte est le dernier administrateur actif.');
  });

  it('redirects to /change-password when the API requires a new password', async () => {
    const auth = TestBed.inject(AuthService);
    auth.currentUser.set(member({ role: 'teacher' }) as never);
    const promise = service.load();
    http.expectOne(api).flush(
      { code: 'PASSWORD_CHANGE_REQUIRED', message: 'Vous devez changer votre mot de passe avant de continuer.' },
      { status: 403, statusText: 'Forbidden' });
    await promise;
    expect(auth.currentUser()!.must_change_password).toBeTrue();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/change-password');
  });
});
