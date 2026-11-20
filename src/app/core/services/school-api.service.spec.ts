import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ApiClass, ApiStudent, SchoolApiService } from './school-api.service';

const api = environment.apiUrl;

const cls = (id: string, name: string, count = 0): ApiClass =>
  ({ id, name, level_id: 'lvl-2', school_year_id: 'sy-2026', student_count: count, teachers: [] });
const student = (id: string, classId: string, className: string): ApiStudent =>
  ({ id, first_name: 'Yakine', last_name: 'Chaabane', gender: 'F', class_id: classId, class_name: className, level_id: 'lvl-2' });

describe('SchoolApiService', () => {
  let service: SchoolApiService;
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
    service = TestBed.inject(SchoolApiService);
    http = TestBed.inject(HttpTestingController);

    const loading = service.load();
    http.expectOne(`${api}/students`).flush([student('std-1', 'cls-a', '2ème A')]);
    http.expectOne(`${api}/classes`).flush([cls('cls-a', '2ème A', 1), cls('cls-b', '2ème B', 0)]);
    http.expectOne(`${api}/classes/teachers`).flush([{ id: 'usr-t', full_name: 'Mme Salma', email: null }]);
    await loading;
  });

  afterEach(() => http.verify());

  it('loads students, classes and teachers', () => {
    expect(service.loaded()).toBeTrue();
    expect(service.students().length).toBe(1);
    expect(service.classes().length).toBe(2);
    expect(service.teachers().length).toBe(1);
  });

  it('adds a student from the server answer and bumps the class count', async () => {
    const promise = service.createStudent({ firstName: 'Adam', lastName: 'Ben Ali', gender: 'M', classId: 'cls-b' });
    const req = http.expectOne(`${api}/students`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...student('std-2', 'cls-b', '2ème B'), first_name: 'Adam', last_name: 'Ben Ali' });
    await promise;
    expect(service.students().map(s => s.id)).toEqual(['std-2', 'std-1']); // sorted by last name
    expect(service.classes().find(c => c.id === 'cls-b')!.student_count).toBe(1);
  });

  it('moves the count when a student changes class', async () => {
    const promise = service.updateStudent('std-1', { classId: 'cls-b' });
    http.expectOne(`${api}/students/std-1`).flush(student('std-1', 'cls-b', '2ème B'));
    await promise;
    expect(service.classes().map(c => c.student_count)).toEqual([0, 1]);
  });

  it('renames the class on its students after a class update', async () => {
    const promise = service.updateClass('cls-a', { name: '2ème Alpha' });
    const req = http.expectOne(`${api}/classes/cls-a`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...cls('cls-a', '2ème Alpha', 1) });
    await promise;
    expect(service.students()[0].class_name).toBe('2ème Alpha');
  });

  it('keeps local state unchanged and surfaces the API message when a delete is refused', async () => {
    const promise = service.deleteClass('cls-a');
    http.expectOne(`${api}/classes/cls-a`).flush(
      { message: 'La classe 2ème A contient encore 1 élève(s).' }, { status: 409, statusText: 'Conflict' });
    await expectAsync(promise).toBeRejectedWithError('La classe 2ème A contient encore 1 élève(s).');
    expect(service.classes().length).toBe(2);
  });

  it('removes a deleted student and decrements its class', async () => {
    const promise = service.deleteStudent('std-1');
    http.expectOne(`${api}/students/std-1`).flush({ deleted: true });
    await promise;
    expect(service.students().length).toBe(0);
    expect(service.classes()[0].student_count).toBe(0);
  });
});
