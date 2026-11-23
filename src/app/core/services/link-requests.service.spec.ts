import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { LinkRequest } from '../models/school.model';
import { LinkRequestsService } from './link-requests.service';

const api = environment.apiUrl;

function request(overrides: Partial<LinkRequest> = {}): LinkRequest {
  return {
    id: 'lr-1', parent_id: 'usr-1', parent_name: 'Sami', child_first_name: 'Youssef',
    child_last_name: 'Ben Ali', status: 'pending', created_at: '2026-11-01T10:00:00Z', ...overrides
  };
}

describe('LinkRequestsService', () => {
  let service: LinkRequestsService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: jasmine.createSpy(), navigateByUrl: jasmine.createSpy() } }
      ]
    });
    service = TestBed.inject(LinkRequestsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function loadWith(requests: LinkRequest[], accounts: unknown[] = []) {
    const promise = service.load(true);
    http.expectOne(`${api}/auth/link-requests`).flush(requests);
    http.expectOne(`${api}/students`).flush([{ id: 'std-1', first_name: 'Youssef', last_name: 'Ben Ali', class_name: '3ème A' }]);
    http.expectOne(`${api}/classes`).flush([{ id: 'cls-3a', name: '3ème A', level_id: 'lvl-3' }]);
    http.expectOne(`${api}/auth/pending-accounts`).flush(accounts);
    await promise;
  }

  it('loads requests and students from the API and splits pending / processed', async () => {
    await loadWith([request(), request({ id: 'lr-2', status: 'approved' })]);
    expect(service.pendingCount()).toBe(1);
    expect(service.processed().length).toBe(1);
    expect(service.students().length).toBe(1);
  });

  it('only loads once unless forced', async () => {
    await loadWith([]);
    await service.load();
    http.expectNone(`${api}/auth/link-requests`);
  });

  it('surfaces a readable error when the API fails', async () => {
    const promise = service.load(true);
    http.expectOne(`${api}/auth/link-requests`).flush({ message: 'Accès refusé : rôle non autorisé.' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(`${api}/students`).flush([]);
    http.expectOne(`${api}/classes`).flush([]);
    http.expectOne(`${api}/auth/pending-accounts`).flush([]);
    await promise;
    expect(service.error()).toBe('Accès refusé : rôle non autorisé.');
    expect(service.loaded()).toBeFalse();
  });

  it('approves with the chosen student and updates the list locally', async () => {
    await loadWith([request()]);
    const promise = service.review('lr-1', { decision: 'approved', studentId: 'std-1', adminNote: '  livret vérifié ' });
    const req = http.expectOne(`${api}/auth/link-requests/lr-1/review`);
    expect(req.request.body).toEqual({ decision: 'approved', studentId: 'std-1', adminNote: 'livret vérifié' });
    req.flush(request({ status: 'approved', student_id: 'std-1' }));
    await promise;
    expect(service.pendingCount()).toBe(0);
    expect(service.processed()[0].admin_note).toBe('livret vérifié');
  });

  it('never sends a student id when rejecting', async () => {
    await loadWith([request()]);
    const promise = service.review('lr-1', { decision: 'rejected', studentId: 'std-1' });
    const req = http.expectOne(`${api}/auth/link-requests/lr-1/review`);
    expect(req.request.body).toEqual({ decision: 'rejected' });
    req.flush(request({ status: 'rejected' }));
    await promise;
  });

  it('keeps the request pending and throws the API message when the review fails', async () => {
    await loadWith([request()]);
    const promise = service.review('lr-1', { decision: 'approved', studentId: 'std-1' });
    http.expectOne(`${api}/auth/link-requests/lr-1/review`)
      .flush({ message: 'Cette demande a déjà été traitée.' }, { status: 400, statusText: 'Bad Request' });
    await expectAsync(promise).toBeRejectedWithError('Cette demande a déjà été traitée.');
    expect(service.pendingCount()).toBe(1);
  });

  it('approves without an existing student: sends the class, adds the created student', async () => {
    await loadWith([request()]);
    const promise = service.review('lr-1', { decision: 'approved', studentId: '', classId: 'cls-3a' });
    const req = http.expectOne(`${api}/auth/link-requests/lr-1/review`);
    expect(req.request.body).toEqual({ decision: 'approved', classId: 'cls-3a' });
    req.flush({ ...request({ status: 'approved', student_id: 'std-new' }), student_created: true,
      student: { id: 'std-new', first_name: 'Rayen', last_name: 'Ben Ali', class_id: 'cls-3a', class_name: '3ème A' } });
    const result = await promise;
    expect(result.student_created).toBeTrue();
    expect(service.students().some(s => s.id === 'std-new')).toBeTrue();
    expect(service.pendingCount()).toBe(0);
  });

  it('lists registrations without a child and activates / refuses them', async () => {
    const acc = (id: string) => ({ id, full_name: 'Parent ' + id, email: id + '@test.tn', phone: null, created_at: '2026-11-23T10:00:00Z' });
    await loadWith([], [acc('a'), acc('b')]);
    expect(service.pendingCount()).toBe(2);

    let promise = service.activateAccount('a');
    http.expectOne(`${api}/auth/pending-accounts/a/activate`).flush({ id: 'a', active: true });
    await promise;
    promise = service.rejectAccount('b');
    http.expectOne(`${api}/auth/pending-accounts/b/reject`).flush({ id: 'b', deleted: true });
    await promise;
    expect(service.pendingAccounts().length).toBe(0);
  });
});
