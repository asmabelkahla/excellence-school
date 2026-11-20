import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ParentAccount, ParentsApiService } from './parents-api.service';

const api = `${environment.apiUrl}/parents`;

const parent = (overrides: Partial<ParentAccount> = {}): ParentAccount => ({
  id: 'usr-parent-1', full_name: 'Asma Belkahla', email: 'asma@excellence.tn', phone: null,
  active: true, must_change_password: false, created_at: '', status: 'active', pending_requests: 0,
  children: [{ student_id: 'std-1', first_name: 'Yakine', last_name: 'Chaabane', class_name: '2ème A', relationship: 'mere' }],
  ...overrides
});

describe('ParentsApiService', () => {
  let service: ParentsApiService;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: jasmine.createSpy(), navigateByUrl: jasmine.createSpy() } }
      ]
    });
    service = TestBed.inject(ParentsApiService);
    http = TestBed.inject(HttpTestingController);

    const loading = service.load();
    http.expectOne(api).flush([
      parent(),
      parent({ id: 'usr-parent-2', full_name: 'Karim', active: false, status: 'pending', pending_requests: 1, children: [] })
    ]);
    await loading;
  });

  afterEach(() => http.verify());

  it('loads parents and counts those waiting for validation', () => {
    expect(service.parents().length).toBe(2);
    expect(service.pendingCount()).toBe(1);
  });

  it('creates an account with an optional first child and never sends a password', async () => {
    const promise = service.create(
      { fullName: ' Sonia Ben Ali ', email: ' Sonia@Mail.TN ', phone: '' },
      [{ studentId: 'std-1', relationship: 'mere' }]
    );
    const req = http.expectOne(api);
    expect(req.request.body).toEqual({
      fullName: 'Sonia Ben Ali', email: 'sonia@mail.tn', children: [{ studentId: 'std-1', relationship: 'mere' }]
    });
    req.flush({ parent: parent({ id: 'usr-parent-3', full_name: 'Sonia Ben Ali', must_change_password: true }), temporaryPassword: 'Tmp4xYz9Qa2b' });
    const result = await promise;
    expect(result.temporaryPassword).toBe('Tmp4xYz9Qa2b');
    expect(service.parents().map(p => p.full_name)).toEqual(['Asma Belkahla', 'Karim', 'Sonia Ben Ali']);
  });

  it('links and unlinks a child from the server answer', async () => {
    let promise = service.linkChild('usr-parent-1', { studentId: 'std-2', relationship: 'pere' });
    let req = http.expectOne(`${api}/usr-parent-1/children`);
    expect(req.request.body).toEqual({ studentId: 'std-2', relationship: 'pere' });
    const twoChildren = parent().children.concat({ student_id: 'std-2', first_name: 'Elae', last_name: 'Chaabane', class_name: '6ème F', relationship: 'pere' });
    req.flush(parent({ children: twoChildren }));
    await promise;
    expect(service.parents()[0].children.length).toBe(2);

    promise = service.unlinkChild('usr-parent-1', 'std-2');
    req = http.expectOne(`${api}/usr-parent-1/children/std-2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(parent());
    await promise;
    expect(service.parents()[0].children.length).toBe(1);
  });

  it('surfaces the refusal when activating a parent whose request is still pending', async () => {
    const promise = service.update('usr-parent-2', { active: true });
    http.expectOne(`${api}/usr-parent-2`).flush(
      { message: 'Ce parent attend la validation de sa demande d’inscription.' }, { status: 400, statusText: 'Bad Request' });
    await expectAsync(promise).toBeRejectedWithError('Ce parent attend la validation de sa demande d’inscription.');
    expect(service.parents()[1].active).toBeFalse();
  });

  it('marks the account as provisional after a password reset', async () => {
    const promise = service.resetPassword('usr-parent-1');
    http.expectOne(`${api}/usr-parent-1/reset-password`).flush({ temporaryPassword: 'New4Pass9xyz' });
    expect(await promise).toBe('New4Pass9xyz');
    expect(service.parents()[0].must_change_password).toBeTrue();
  });
});
