import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { HomeworkApiService, daysUntil, todayIso } from './homework-api.service';
import { NotificationsApiService } from './notifications-api.service';

const api = environment.apiUrl;

describe('Homework & notifications services', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideServiceWorker('ngsw-worker.js', { enabled: false }),
        { provide: Router, useValue: { navigate: jasmine.createSpy(), navigateByUrl: jasmine.createSpy() } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('computes days until a due date', () => {
    expect(daysUntil(todayIso())).toBe(0);
    const d = new Date(`${todayIso()}T12:00:00`);
    d.setDate(d.getDate() + 3);
    expect(daysUntil(d.toISOString().slice(0, 10))).toBe(3);
  });

  it('ticks homework optimistically and rolls back if the API refuses', async () => {
    const auth = TestBed.inject(AuthService);
    const homework = TestBed.inject(HomeworkApiService);
    auth.selectedStudent.set({ id: 'std-1', first_name: 'Yakine', last_name: 'C' } as never);
    homework.childHomework.set([{ id: 'hw-1', title: 'Lecture', description: null, due_date: todayIso(), subject_name: 'Lecture', subject_name_ar: null, teacher_name: null, created_at: '', done: false }]);

    const ok = homework.setDone('hw-1', true);
    expect(homework.pendingCount()).toBe(0); // optimistic
    const req = http.expectOne(`${api}/me/children/std-1/homework/hw-1/done`);
    expect(req.request.body).toEqual({ done: true });
    req.flush({ done: true });
    await ok;

    const ko = homework.setDone('hw-1', false);
    http.expectOne(`${api}/me/children/std-1/homework/hw-1/done`).flush({ message: 'Devoir introuvable.' }, { status: 404, statusText: 'Not Found' });
    await expectAsync(ko).toBeRejectedWithError('Devoir introuvable.');
    expect(homework.childHomework()[0].done).toBeTrue(); // rolled back
  });

  it('creates homework with trimmed fields', async () => {
    const homework = TestBed.inject(HomeworkApiService);
    const p = homework.create({ classSubjectId: 'cs-2a-math', title: '  Tables  ', description: ' ', dueDate: '2026-12-01' });
    const req = http.expectOne(`${api}/teaching/homework`);
    expect(req.request.body).toEqual({ classSubjectId: 'cs-2a-math', title: 'Tables', description: '', dueDate: '2026-12-01' });
    req.flush({ id: 'hw-9' });
    await p;
  });

  it('marks all notifications read and updates the badge', async () => {
    const notifications = TestBed.inject(NotificationsApiService);
    TestBed.flushEffects();
    notifications.items.set([{ id: 'n1', type: 'homework', title: 't', body: 'b', link: null, student_id: null, created_at: '', read_at: null }]);
    const p = notifications.markRead();
    http.expectOne(`${api}/notifications/read-all`).flush({ unread: 0 });
    await p;
    expect(notifications.unread()).toBe(0);
    expect(notifications.items()[0].read_at).not.toBeNull();
  });

  it('reports push as unsupported when the service worker is disabled', async () => {
    const notifications = TestBed.inject(NotificationsApiService);
    expect(await notifications.detectPushState()).toBe(/iPhone|iPad/.test(navigator.userAgent) ? 'needs-install' : 'unsupported');
  });
});
