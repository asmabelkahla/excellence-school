import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService, readableApiError } from './auth.service';

export interface ApiStudent {
  id: string;
  first_name: string;
  last_name: string;
  first_name_ar?: string | null;
  last_name_ar?: string | null;
  gender: 'F' | 'M' | null;
  birth_date?: string | null;
  class_id: string | null;
  class_name: string | null;
  level_id: string | null;
}

export interface ApiClass {
  id: string;
  name: string;
  level_id: string | null;
  school_year_id: string | null;
  student_count: number;
  teachers: { id: string; full_name: string }[];
}

export interface ApiTeacher {
  id: string;
  full_name: string;
  email: string | null;
}

export interface StudentInput {
  firstName: string;
  lastName: string;
  firstNameAr?: string;
  lastNameAr?: string;
  gender: 'F' | 'M';
  classId: string;
}

export interface ClassInput {
  name: string;
  levelId: string;
  teacherIds: string[];
}

/**
 * Students and classes, backed by the NestJS API (`/students`, `/classes`).
 * Every write goes to the server first; local state is only updated from its answer.
 */
@Injectable({ providedIn: 'root' })
export class SchoolApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  readonly students = signal<ApiStudent[]>([]);
  readonly classes = signal<ApiClass[]>([]);
  readonly teachers = signal<ApiTeacher[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Drop another account's data on logout or account switch.
    const auth = inject(AuthService);
    let previousUserId: string | null = null;
    effect(() => {
      const userId = auth.currentUser()?.id ?? null;
      if (previousUserId !== null && userId !== previousUserId) this.reset();
      previousUserId = userId;
    });
  }

  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const [students, classes, teachers] = await Promise.all([
        firstValueFrom(this.http.get<ApiStudent[]>(`${this.api}/students`)),
        firstValueFrom(this.http.get<ApiClass[]>(`${this.api}/classes`)),
        firstValueFrom(this.http.get<ApiTeacher[]>(`${this.api}/classes/teachers`))
      ]);
      this.students.set(students);
      this.classes.set(classes);
      this.teachers.set(teachers);
      this.loaded.set(true);
    } catch (error) {
      this.error.set(readableApiError(error, 'Impossible de charger les élèves et les classes.'));
    } finally {
      this.loading.set(false);
    }
  }

  // ------------------------------------------------------------- students

  async createStudent(input: StudentInput): Promise<ApiStudent> {
    const student = await this.call(this.http.post<ApiStudent>(`${this.api}/students`, input));
    this.students.update(list => sortStudents([...list, student]));
    this.adjustCount(student.class_id, +1);
    return student;
  }

  async updateStudent(id: string, input: Partial<StudentInput>): Promise<ApiStudent> {
    const before = this.students().find(s => s.id === id);
    const student = await this.call(this.http.patch<ApiStudent>(`${this.api}/students/${encodeURIComponent(id)}`, input));
    this.students.update(list => sortStudents(list.map(s => (s.id === id ? student : s))));
    if (before && before.class_id !== student.class_id) {
      this.adjustCount(before.class_id, -1);
      this.adjustCount(student.class_id, +1);
    }
    return student;
  }

  async deleteStudent(id: string): Promise<void> {
    const before = this.students().find(s => s.id === id);
    await this.call(this.http.delete(`${this.api}/students/${encodeURIComponent(id)}`));
    this.students.update(list => list.filter(s => s.id !== id));
    if (before) this.adjustCount(before.class_id, -1);
  }

  // -------------------------------------------------------------- classes

  async createClass(input: ClassInput): Promise<ApiClass> {
    const cls = await this.call(this.http.post<ApiClass>(`${this.api}/classes`, input));
    this.classes.update(list => sortClasses([...list, cls]));
    return cls;
  }

  async updateClass(id: string, input: Partial<ClassInput>): Promise<ApiClass> {
    const cls = await this.call(this.http.patch<ApiClass>(`${this.api}/classes/${encodeURIComponent(id)}`, input));
    this.classes.update(list => sortClasses(list.map(c => (c.id === id ? cls : c))));
    // The server renames the class on its students too.
    this.students.update(list =>
      list.map(s => (s.class_id === id ? { ...s, class_name: cls.name, level_id: cls.level_id } : s))
    );
    return cls;
  }

  async deleteClass(id: string): Promise<void> {
    await this.call(this.http.delete(`${this.api}/classes/${encodeURIComponent(id)}`));
    this.classes.update(list => list.filter(c => c.id !== id));
  }

  reset(): void {
    this.students.set([]);
    this.classes.set([]);
    this.teachers.set([]);
    this.loaded.set(false);
    this.error.set(null);
  }

  private adjustCount(classId: string | null, delta: number): void {
    if (!classId) return;
    this.classes.update(list =>
      list.map(c => (c.id === classId ? { ...c, student_count: Math.max(0, c.student_count + delta) } : c))
    );
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw new Error(readableApiError(error));
    }
  }
}

function sortStudents(list: ApiStudent[]): ApiStudent[] {
  return [...list].sort((a, b) =>
    a.last_name.localeCompare(b.last_name, 'fr') || a.first_name.localeCompare(b.first_name, 'fr'));
}

function sortClasses(list: ApiClass[]): ApiClass[] {
  return [...list].sort((a, b) =>
    (a.level_id ?? '').localeCompare(b.level_id ?? '') || a.name.localeCompare(b.name, 'fr'));
}
