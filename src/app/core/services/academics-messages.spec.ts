import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AcademicsApiService } from './academics-api.service';
import { MessagesApiService } from './messages-api.service';

const api = environment.apiUrl;

describe('AcademicsApiService & MessagesApiService', () => {
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
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads a grading sheet for the chosen trimester', async () => {
    const academics = TestBed.inject(AcademicsApiService);
    const promise = academics.sheet('cs-2a-fr', 2);
    const req = http.expectOne(r => r.url === `${api}/teaching/class-subjects/cs-2a-fr/sheet`);
    expect(req.request.params.get('trimester')).toBe('2');
    req.flush({ class_subject: { id: 'cs-2a-fr' }, trimester: 2, components: [], students: [] });
    expect((await promise).trimester).toBe(2);
  });

  it('saves only the rows given, with null to erase a score', async () => {
    const academics = TestBed.inject(AcademicsApiService);
    const promise = academics.saveSheet('cs-2a-math', 1, [{ studentId: 'std-1', scores: { '': null }, remark: '' }]);
    const req = http.expectOne(`${api}/teaching/class-subjects/cs-2a-math/sheet`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ trimester: 1, rows: [{ studentId: 'std-1', scores: { '': null }, remark: '' }] });
    req.flush({ class_subject: {}, trimester: 1, components: [], students: [] });
    await promise;
  });

  it('surfaces the refusal to publish an incomplete bulletin', async () => {
    const academics = TestBed.inject(AcademicsApiService);
    const promise = academics.publish('rc-1');
    http.expectOne(`${api}/report-cards/rc-1/publish`).flush(
      { message: 'Notes manquantes (Anglais) : complétez-les puis régénérez le bulletin.' },
      { status: 400, statusText: 'Bad Request' });
    await expectAsync(promise).toBeRejectedWithError(/Notes manquantes/);
  });

  it('reads a child\'s published bulletins through the parent route', async () => {
    const academics = TestBed.inject(AcademicsApiService);
    const promise = academics.childReportCards('std-yakine-chaabane');
    http.expectOne(`${api}/me/children/std-yakine-chaabane/report-cards`).flush([]);
    expect(await promise).toEqual([]);
  });

  it('starts a parent thread with the chosen teacher, never as a note', async () => {
    const messages = TestBed.inject(MessagesApiService);
    const promise = messages.start('std-1', { body: '  Bonjour  ' }, 'usr-teacher-1');
    const req = http.expectOne(`${api}/messages/conversations`);
    expect(req.request.body).toEqual({ studentId: 'std-1', teacherId: 'usr-teacher-1', body: 'Bonjour' });
    req.flush({ id: 'conv-1', messages: [] });
    await promise;
  });

  it('sends a teacher note with its category and refreshes the unread badge on open', async () => {
    const messages = TestBed.inject(MessagesApiService);
    TestBed.flushEffects(); // initial "signed out" effect, as at app start-up
    const post = messages.post('conv-1', { body: 'Bravo', kind: 'note', category: 'encouragement' });
    const req = http.expectOne(`${api}/messages/conversations/conv-1/messages`);
    expect(req.request.body).toEqual({ body: 'Bravo', kind: 'note', category: 'encouragement' });
    req.flush({ id: 'conv-1', messages: [] });
    await post;

    const open = messages.thread('conv-1');
    http.expectOne(`${api}/messages/conversations/conv-1`).flush({ id: 'conv-1', messages: [] });
    await open;
    http.expectOne(`${api}/messages/unread-count`).flush({ unread: 3 });
    await new Promise(resolve => setTimeout(resolve));
    expect(messages.unread()).toBe(3);
  });
});
