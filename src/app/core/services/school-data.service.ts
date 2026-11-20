import { Injectable, signal, computed } from '@angular/core';
import {
  SchoolYear, Level, SchoolClass, Student, LinkRequest,
  ParentStudent, UserProfile, UserRole, AttendanceStatus, FeeStatus, PaymentMethod, StaffInvitation,
  AnnexServicePlan, ServiceEnrollment, FinancialMovement, FinancialSummary, AnnexServiceType
} from '../models/school.model';
import {
  Domain, Subject, SubjectComponent, ClassSubject, Grade, ReportCard
} from '../models/academics.model';
import {
  AttendanceRecord, HomeworkItem, TimetableSlot, EventItem, NewsItem, ReviewItem,
  Appointment, NotificationItem
} from '../models/communication.model';
import { Fee, FeeStatistics } from '../models/finance.model';

@Injectable({
  providedIn: 'root'
})
export class SchoolDataService {
  // Reactive Signals for all entities
  readonly schoolYears = signal<SchoolYear[]>([]);
  readonly levels = signal<Level[]>([]);
  readonly classes = signal<SchoolClass[]>([]);
  readonly students = signal<Student[]>([]);
  readonly parentStudents = signal<ParentStudent[]>([]);
  readonly linkRequests = signal<LinkRequest[]>([]);
  readonly domains = signal<Domain[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly subjectComponents = signal<SubjectComponent[]>([]);
  readonly classSubjects = signal<ClassSubject[]>([]);
  readonly grades = signal<Grade[]>([]);
  readonly reportCards = signal<ReportCard[]>([]);
  readonly attendance = signal<AttendanceRecord[]>([]);
  readonly homework = signal<HomeworkItem[]>([]);
  readonly timetableSlots = signal<TimetableSlot[]>([]);
  readonly events = signal<EventItem[]>([]);
  readonly news = signal<NewsItem[]>([]);
  readonly fees = signal<Fee[]>([]);
  readonly appointments = signal<Appointment[]>([]);
  readonly notifications = signal<NotificationItem[]>([]);
  readonly reviews = signal<ReviewItem[]>([]);
  readonly users = signal<UserProfile[]>([]);
  readonly staffInvitations = signal<StaffInvitation[]>([]);
  readonly annexServicePlans = signal<AnnexServicePlan[]>([]);
  readonly serviceEnrollments = signal<ServiceEnrollment[]>([]);
  readonly financialMovements = signal<FinancialMovement[]>([]);

  readonly financialSummary = computed<FinancialSummary>(() => {
    const movements = this.financialMovements();
    const summary = movements.reduce((acc, movement) => {
      if (movement.type === 'income') {
        acc.total_income += movement.amount;
        if (movement.category === 'bus') acc.bus_income += movement.amount;
        if (movement.category === 'garderie') acc.garderie_income += movement.amount;
        if (movement.category === 'etude') acc.etude_income += movement.amount;
      } else {
        acc.total_expense += movement.amount;
      }
      return acc;
    }, {
      total_income: 0,
      total_expense: 0,
      balance: 0,
      bus_income: 0,
      garderie_income: 0,
      etude_income: 0
    });

    summary.balance = summary.total_income - summary.total_expense;
    return summary;
  });

  // Computed statistics
  readonly feeStatistics = computed<FeeStatistics>(() => {
    const allFees = this.fees();
    let total_expected = 0;
    let total_collected = 0;
    let total_pending = 0;
    let total_overdue = 0;
    let count_paid = 0;
    let count_pending = 0;
    let count_overdue = 0;

    const today = new Date().toISOString().split('T')[0];

    for (const f of allFees) {
      total_expected += f.amount;
      if (f.status === 'paid') {
        total_collected += f.paid_amount || f.amount;
        count_paid++;
      } else if (f.status === 'pending') {
        if (f.due_date < today) {
          total_overdue += f.amount;
          count_overdue++;
        } else {
          total_pending += f.amount;
          count_pending++;
        }
      }
    }

    return {
      total_expected,
      total_collected,
      total_pending,
      total_overdue,
      count_paid,
      count_pending,
      count_overdue
    };
  });

  constructor() {
    this.loadInitialData();
  }

  private makeUniqueId(prefix: string): string {
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    return `${prefix}-${Date.now()}-${randomSuffix}`;
  }

  getStudentScopedHomework(student?: Student | null): HomeworkItem[] {
    if (!student) {
      return this.homework();
    }

    return this.homework().filter(item => {
      if (item.target_student_ids && item.target_student_ids.length > 0) {
        return item.target_student_ids.includes(student.id);
      }

      if (item.class_id && student.class_id) {
        return item.class_id === student.class_id;
      }

      return !item.class_id;
    });
  }

  getStudentScopedTimetable(student?: Student | null): TimetableSlot[] {
    if (!student || !student.class_id) {
      return this.timetableSlots();
    }

    return this.timetableSlots().filter(slot => slot.class_id === student.class_id);
  }

  private loadInitialData() {
    // Try to load persisted state from localStorage
    const saved = localStorage.getItem('esm_school_data_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.schoolYears.set(parsed.schoolYears || []);
        this.levels.set(parsed.levels || []);
        this.classes.set(parsed.classes || []);
        this.students.set(parsed.students || []);
        this.parentStudents.set(parsed.parentStudents || []);
        this.linkRequests.set(parsed.linkRequests || []);
        this.domains.set(parsed.domains || []);
        this.subjects.set(parsed.subjects || []);
        this.subjectComponents.set(parsed.subjectComponents || []);
        this.classSubjects.set(parsed.classSubjects || []);
        this.grades.set(parsed.grades || []);
        this.reportCards.set(parsed.reportCards || []);
        this.attendance.set(parsed.attendance || []);
        this.homework.set(parsed.homework || []);
        this.timetableSlots.set(parsed.timetableSlots || []);
        this.events.set(parsed.events || []);
        this.news.set(parsed.news || []);
        this.fees.set(parsed.fees || []);
        this.appointments.set(parsed.appointments || []);
        this.notifications.set(parsed.notifications || []);
        this.reviews.set(parsed.reviews || []);
        this.users.set(parsed.users || []);
        this.staffInvitations.set(parsed.staffInvitations || []);
        this.annexServicePlans.set(parsed.annexServicePlans || []);
        this.serviceEnrollments.set(parsed.serviceEnrollments || []);
        this.financialMovements.set(parsed.financialMovements || []);
        return;
      } catch (e) {
        console.warn('Failed parsing saved state, resetting to seed data', e);
      }
    }

    this.seedDefaultData();
  }

  saveToStorage() {
    const data = {
      schoolYears: this.schoolYears(),
      levels: this.levels(),
      classes: this.classes(),
      students: this.students(),
      parentStudents: this.parentStudents(),
      linkRequests: this.linkRequests(),
      domains: this.domains(),
      subjects: this.subjects(),
      subjectComponents: this.subjectComponents(),
      classSubjects: this.classSubjects(),
      grades: this.grades(),
      reportCards: this.reportCards(),
      attendance: this.attendance(),
      homework: this.homework(),
      timetableSlots: this.timetableSlots(),
      events: this.events(),
      news: this.news(),
      fees: this.fees(),
      appointments: this.appointments(),
      notifications: this.notifications(),
      reviews: this.reviews(),
      // Never persist passwords in the browser.
      users: this.users().map(({ password, ...user }) => user),
      staffInvitations: this.staffInvitations(),
      annexServicePlans: this.annexServicePlans(),
      serviceEnrollments: this.serviceEnrollments(),
      financialMovements: this.financialMovements()
    };
    try {
      localStorage.setItem('esm_school_data_v1', JSON.stringify(data));
    } catch (e) {
      console.warn('Storage quota exceeded or error saving:', e);
    }
  }

  // --- MUTATION METHODS ---

  addLevel(data: Partial<Level> & { code: string; name_fr: string; name_ar: string; position: number }): Level {
    const code = (data.code || '').trim();
    const nameFr = (data.name_fr || '').trim();
    const nameAr = (data.name_ar || '').trim();

    if (!code || !nameFr || !nameAr) {
      throw new Error('Le code, le nom français et le nom arabe du niveau sont requis.');
    }

    const exists = this.levels().some(level => level.code.toLowerCase() === code.toLowerCase());
    if (exists) {
      throw new Error('Ce code de niveau existe déjà.');
    }

    const level: Level = {
      id: data.id || `lvl-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      code,
      name_fr: nameFr,
      name_ar: nameAr,
      position: data.position ?? this.levels().length
    };

    this.levels.update(list => [...list, level].sort((a, b) => a.position - b.position));
    this.saveToStorage();
    return level;
  }

  updateLevel(levelId: string, updates: Partial<Level>): Level | null {
    const existing = this.levels().find(level => level.id === levelId);
    if (!existing) {
      return null;
    }

    const code = (updates.code || existing.code).trim();
    const duplicate = this.levels().find(level => level.id !== levelId && level.code.toLowerCase() === code.toLowerCase());
    if (duplicate) {
      throw new Error('Un autre niveau porte déjà ce code.');
    }

    const updated: Level = {
      ...existing,
      ...updates,
      code,
      name_fr: (updates.name_fr || existing.name_fr).trim(),
      name_ar: (updates.name_ar || existing.name_ar).trim(),
      position: updates.position ?? existing.position
    };

    this.levels.update(list => list.map(level => (level.id === levelId ? updated : level)).sort((a, b) => a.position - b.position));
    this.saveToStorage();
    return updated;
  }

  deleteLevel(levelId: string): boolean {
    const exists = this.levels().some(level => level.id === levelId);
    if (!exists) {
      return false;
    }

    const nextDefault = this.levels().find(level => level.id !== levelId) || null;
    this.levels.update(list => list.filter(level => level.id !== levelId));
    this.classes.update(list =>
      list.map(cls => cls.level_id === levelId ? { ...cls, level_id: nextDefault?.id || cls.level_id } : cls)
    );
    this.saveToStorage();
    return true;
  }

  updateClass(classId: string, updates: Partial<SchoolClass>): SchoolClass | null {
    const existing = this.classes().find(c => c.id === classId);
    if (!existing) {
      return null;
    }

    const nextName = updates.name?.trim();
    if (nextName) {
      const duplicate = this.classes().find(c => c.id !== classId && c.name.toLowerCase() === nextName.toLowerCase());
      if (duplicate) {
        throw new Error('Une autre classe porte déjà ce nom.');
      }
    }

    const teacherIds = this.normalizeTeacherIds(updates.teacher_ids, updates.teacher_id ?? existing.teacher_id);
    const teacherNames = this.normalizeTeacherNames(updates.teacher_names, updates.teacher_name ?? existing.teacher_name, teacherIds);
    const primaryTeacherId = teacherIds[0] || updates.teacher_id || existing.teacher_id;
    const primaryTeacher = primaryTeacherId ? this.users().find(u => u.id === primaryTeacherId && u.role === 'teacher') : undefined;

    const updated: SchoolClass = {
      ...existing,
      ...updates,
      name: nextName || existing.name,
      school_year_id: updates.school_year_id || existing.school_year_id,
      level_id: updates.level_id || existing.level_id,
      teacher_id: primaryTeacher?.id || primaryTeacherId || undefined,
      teacher_name: primaryTeacher?.full_name || teacherNames[0] || updates.teacher_name || existing.teacher_name || '',
      teacher_ids: teacherIds,
      teacher_names: teacherNames,
      student_count: updates.student_count ?? existing.student_count ?? 0
    };

    this.classes.update(list => list.map(c => (c.id === classId ? updated : c)));
    this.saveToStorage();
    return updated;
  }

  private normalizeTeacherIds(teacherIds?: string[], fallbackTeacherId?: string): string[] {
    const explicitIds = (teacherIds ?? []).filter((value): value is string => Boolean(value && value.trim()));
    if (explicitIds.length > 0) {
      return Array.from(new Set(explicitIds));
    }

    if (fallbackTeacherId && fallbackTeacherId.trim()) {
      return [fallbackTeacherId];
    }

    return [];
  }

  private normalizeTeacherNames(teacherNames?: string[], fallbackTeacherName?: string, teacherIds: string[] = []): string[] {
    const explicitNames = (teacherNames ?? []).filter((value): value is string => Boolean(value && value.trim()));
    if (explicitNames.length > 0) {
      return Array.from(new Set(explicitNames));
    }

    const resolvedFromIds = teacherIds
      .map(id => this.users().find(user => user.id === id && user.role === 'teacher')?.full_name)
      .filter((value): value is string => Boolean(value && value.trim()));

    if (resolvedFromIds.length > 0) {
      return Array.from(new Set(resolvedFromIds));
    }

    if (fallbackTeacherName && fallbackTeacherName.trim()) {
      return [fallbackTeacherName];
    }

    return [];
  }

  deleteClass(classId: string): boolean {
    const exists = this.classes().some(c => c.id === classId);
    if (!exists) {
      return false;
    }

    this.classes.update(list => list.filter(c => c.id !== classId));
    this.students.update(list =>
      list.map(student =>
        student.class_id === classId
          ? { ...student, class_id: undefined, class_name: 'Classe non attribuée' }
          : student
      )
    );
    this.saveToStorage();
    return true;
  }

  updateStudent(studentId: string, updates: Partial<Student>): Student | null {
    const existing = this.students().find(s => s.id === studentId);
    if (!existing) {
      return null;
    }

    const updated: Student = { ...existing, ...updates };
    this.students.update(list => list.map(s => (s.id === studentId ? updated : s)));
    this.parentStudents.update(list =>
      list.map(link => (link.student_id === studentId ? { ...link, student: updated } : link))
    );
    this.saveToStorage();
    return updated;
  }

  deleteStudent(studentId: string): boolean {
    const exists = this.students().some(s => s.id === studentId);
    if (!exists) {
      return false;
    }

    this.students.update(list => list.filter(s => s.id !== studentId));
    this.parentStudents.update(list => list.filter(link => link.student_id !== studentId));
    this.saveToStorage();
    return true;
  }

  // Attendance
  recordAttendance(record: Omit<AttendanceRecord, 'id' | 'created_at'>) {
    const id = 'att-' + record.student_id + '-' + record.day;
    this.attendance.update(list => {
      const filtered = list.filter(a => !(a.student_id === record.student_id && a.day === record.day));
      return [...filtered, { ...record, id, created_at: new Date().toISOString() }];
    });
    this.saveToStorage();
  }

  submitAbsenceJustification(attendanceId: string, reason: string, attachmentPath?: string) {
    this.attendance.update(list =>
      list.map(a => {
        if (a.id === attendanceId) {
          return {
            ...a,
            justification: {
              id: 'justif-' + Date.now(),
              attendance_id: attendanceId,
              parent_id: 'usr-parent-1',
              reason,
              attachment_path: attachmentPath,
              created_at: new Date().toISOString()
            }
          };
        }
        return a;
      })
    );
    this.saveToStorage();
  }

  // Fees & Payments
  recordPayment(feeId: string, amount: number, method: PaymentMethod, reference: string, note?: string) {
    const today = new Date().toISOString().split('T')[0];
    this.fees.update(list =>
      list.map(f => {
        if (f.id === feeId) {
          return {
            ...f,
            status: 'paid',
            paid_amount: amount,
            paid_at: today,
            method,
            reference,
            note,
            receipt_path: `receipts/${f.student_id}/${f.id}.pdf`,
            updated_at: new Date().toISOString()
          };
        }
        return f;
      })
    );
    this.saveToStorage();
  }

  // Appointments
  requestAppointment(appointment: Omit<Appointment, 'id' | 'status' | 'created_at'>) {
    const newAppt: Appointment = {
      ...appointment,
      id: 'appt-' + Date.now(),
      status: 'pending',
      created_at: new Date().toISOString()
    };
    this.appointments.update(list => [newAppt, ...list]);
    this.saveToStorage();
    return newAppt;
  }

  updateAppointmentStatus(
    id: string,
    status: Appointment['status'],
    details?: {
      confirmed_start?: string;
      confirmed_end?: string;
      location?: string;
      decline_reason?: string;
      proposals?: Appointment['proposals'];
    }
  ) {
    this.appointments.update(list =>
      list.map(a => {
        if (a.id === id) {
          return {
            ...a,
            status,
            ...details,
            updated_at: new Date().toISOString()
          };
        }
        return a;
      })
    );
    this.saveToStorage();
  }

  // News
  addNews(newsItem: Omit<NewsItem, 'id' | 'created_at'>) {
    const newItem: NewsItem = {
      ...newsItem,
      id: 'news-' + Date.now(),
      created_at: new Date().toISOString()
    };
    this.news.update(list => [newItem, ...list]);
    this.saveToStorage();
    return newItem;
  }

  addReview(review: Omit<ReviewItem, 'id' | 'created_at'>) {
    const newReview: ReviewItem = {
      ...review,
      id: 'rev-' + Date.now(),
      created_at: new Date().toISOString()
    };
    this.reviews.update(list => [newReview, ...list]);
    this.saveToStorage();
    return newReview;
  }

  addAnnexServicePlan(plan: Omit<AnnexServicePlan, 'id' | 'created_at'>): AnnexServicePlan {
    const newPlan: AnnexServicePlan = {
      ...plan,
      id: this.makeUniqueId('svc'),
      created_at: new Date().toISOString()
    };
    this.annexServicePlans.update(list => [newPlan, ...list]);
    this.saveToStorage();
    return newPlan;
  }

  enrollStudentInService(data: {
    student_id: string;
    student_name: string;
    parent_id?: string;
    service_type: AnnexServiceType;
    service_label: string;
    amount: number;
    status?: 'active' | 'paused' | 'cancelled';
    start_date?: string;
  }): ServiceEnrollment {
    const enrollment: ServiceEnrollment = {
      id: this.makeUniqueId('svc-enr'),
      student_id: data.student_id,
      student_name: data.student_name,
      parent_id: data.parent_id,
      service_type: data.service_type,
      service_label: data.service_label,
      amount: data.amount,
      status: data.status || 'active',
      start_date: data.start_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    this.serviceEnrollments.update(list => [enrollment, ...list.filter(item => !(item.student_id === data.student_id && item.service_type === data.service_type))]);

    const existingMovement = this.financialMovements().find(m => m.student_id === data.student_id && m.category === data.service_type && m.label === data.service_label);
    if (!existingMovement) {
      this.financialMovements.update(list => [{
        id: 'fin-' + Date.now(),
        type: 'income',
        category: data.service_type,
        label: data.service_label,
        amount: data.amount,
        student_id: data.student_id,
        student_name: data.student_name,
        created_at: new Date().toISOString()
      }, ...list]);
    }

    this.saveToStorage();
    return enrollment;
  }

  addFinancialMovement(movement: Omit<FinancialMovement, 'id' | 'created_at'>): FinancialMovement {
    const item: FinancialMovement = {
      ...movement,
      id: this.makeUniqueId('fin'),
      created_at: new Date().toISOString()
    };
    this.financialMovements.update(list => [item, ...list]);
    this.saveToStorage();
    return item;
  }

  addSubject(data: Partial<Subject> & { domain_id: string; name_fr: string; name_ar: string }): Subject {
    const nameFr = data.name_fr.trim();
    const nameAr = data.name_ar.trim();
    if (!nameFr || !nameAr) throw new Error('Les noms français et arabe sont requis.');
    if (this.subjects().some(item => item.name_fr.toLowerCase() === nameFr.toLowerCase())) throw new Error('Cette matière existe déjà.');

    const subject: Subject = {
      id: `sbj-${nameFr.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      domain_id: data.domain_id,
      name_fr: nameFr,
      name_ar: nameAr,
      is_foreign_language: data.is_foreign_language ?? false,
      position: data.position ?? 1
    };
    this.subjects.update(list => [...list, subject]);
    this.saveToStorage();
    return subject;
  }

  // --- SEED DATA INITIALIZATION (Directly corresponding to schema.sql) ---
  private seedDefaultData() {
    const currentYear: SchoolYear = {
      id: 'sy-2026-2027',
      label: '2026-2027',
      start_date: '2026-09-15',
      end_date: '2027-06-30',
      is_current: true
    };
    this.schoolYears.set([currentYear]);

    // Levels
    const levelsData: Level[] = [
      { id: 'lvl-prep', code: 'prep', name_fr: 'Préparatoire', name_ar: 'التحضيري', position: 0 },
      { id: 'lvl-1', code: '1', name_fr: '1ère année', name_ar: 'السنة الأولى', position: 1 },
      { id: 'lvl-2', code: '2', name_fr: '2ème année', name_ar: 'السنة الثانية', position: 2 },
      { id: 'lvl-3', code: '3', name_fr: '3ème année', name_ar: 'السنة الثالثة', position: 3 },
      { id: 'lvl-4', code: '4', name_fr: '4ème année', name_ar: 'السنة الرابعة', position: 4 },
      { id: 'lvl-5', code: '5', name_fr: '5ème année', name_ar: 'السنة الخامسة', position: 5 },
      { id: 'lvl-6', code: '6', name_fr: '6ème année', name_ar: 'السنة السادسة', position: 6 }
    ];
    this.levels.set(levelsData);

    // Classes
    const classesData: SchoolClass[] = [
      { id: 'cls-3a', school_year_id: currentYear.id, level_id: 'lvl-3', name: '3ème A', teacher_id: 'usr-teacher-1', teacher_name: 'Mme Salma Kallel', student_count: 22 },
      { id: 'cls-3b', school_year_id: currentYear.id, level_id: 'lvl-3', name: '3ème B', teacher_id: 'usr-teacher-2', teacher_name: 'M. Sami Bouazizi', student_count: 20 },
      { id: 'cls-1a', school_year_id: currentYear.id, level_id: 'lvl-1', name: '1ère A', teacher_id: 'usr-teacher-1', teacher_name: 'Mme Salma Kallel', student_count: 18 },
      { id: 'cls-2a', school_year_id: currentYear.id, level_id: 'lvl-2', name: '2ème A', teacher_id: 'usr-teacher-2', teacher_name: 'M. Sami Bouazizi', student_count: 21 },
      { id: 'cls-4a', school_year_id: currentYear.id, level_id: 'lvl-4', name: '4ème A', teacher_id: 'usr-teacher-1', teacher_name: 'Mme Salma Kallel', student_count: 24 },
      { id: 'cls-5a', school_year_id: currentYear.id, level_id: 'lvl-5', name: '5ème A', teacher_id: 'usr-teacher-2', teacher_name: 'M. Sami Bouazizi', student_count: 20 },
      { id: 'cls-6a', school_year_id: currentYear.id, level_id: 'lvl-6', name: '6ème A', teacher_id: 'usr-teacher-1', teacher_name: 'Mme Salma Kallel', student_count: 23 },
      { id: 'cls-6f', school_year_id: currentYear.id, level_id: 'lvl-6', name: '6ème F', teacher_id: 'usr-teacher-2', teacher_name: 'M. Sami Bouazizi', student_count: 18 }
    ];
    this.classes.set(classesData);

    // Production defaults: only one super-admin exists by default.
    const usersData: UserProfile[] = [
      {
        id: 'usr-admin-1',
        role: 'admin',
        full_name: 'Super Admin Excellence School',
        phone: '+216 73 456 789',
        email: 'admin@excellence.tn',
        password: 'Admin123!',
        locale: 'fr',
        active: true,
        avatar_url: 'assets/avatars/admin.png',
        is_super_admin: true,
        created_at: '2026-09-01T08:00:00Z'
      }
    ];

    this.users.set(usersData);

    // Students
    const studentsData: Student[] = [
      {
        id: 'std-yakine-chaabane',
        first_name: 'Yakine',
        last_name: 'Chaabane',
        first_name_ar: 'ياسمين',
        last_name_ar: 'الشاباني',
        birth_date: '2015-02-18',
        gender: 'F',
        class_id: 'cls-2a',
        class_name: '2ème A',
        level_id: 'lvl-2'
      },
      {
        id: 'std-elae-chaabane',
        first_name: 'Elae Errahmene',
        last_name: 'Chaabane',
        first_name_ar: 'إلاء الرحمن',
        last_name_ar: 'الشاباني',
        birth_date: '2013-10-08',
        gender: 'F',
        class_id: 'cls-6f',
        class_name: '6ème F',
        level_id: 'lvl-6'
      },
      {
        id: 'std-adam',
        first_name: 'Adam',
        last_name: 'Trabelsi',
        first_name_ar: 'آدم',
        last_name_ar: 'الطرابلسي',
        birth_date: '2016-02-18',
        gender: 'M',
        class_id: 'cls-3a',
        class_name: '3ème A',
        level_id: 'lvl-3'
      },
      {
        id: 'std-nour',
        first_name: 'Nour',
        last_name: 'Jaziri',
        first_name_ar: 'نور',
        last_name_ar: 'الجزيري',
        birth_date: '2016-11-05',
        gender: 'F',
        class_id: 'cls-3a',
        class_name: '3ème A',
        level_id: 'lvl-3'
      },
      {
        id: 'std-eya',
        first_name: 'Eya',
        last_name: 'Gharbi',
        first_name_ar: 'آية',
        last_name_ar: 'الغربي',
        birth_date: '2016-07-22',
        gender: 'F',
        class_id: 'cls-3a',
        class_name: '3ème A',
        level_id: 'lvl-3'
      }
    ];
    this.students.set(studentsData);

    // Parent Students links
    this.parentStudents.set([
      {
        parent_id: 'usr-parent-1',
        student_id: 'std-yakine-chaabane',
        relationship: 'mère',
        student: studentsData[0]
      },
      {
        parent_id: 'usr-parent-1',
        student_id: 'std-elae-chaabane',
        relationship: 'mère',
        student: studentsData[1]
      }
    ]);

    // Domains and Subjects matching schema.sql
    const domainsData: Domain[] = [
      { id: 'dom-ar', name_fr: 'Langue arabe', name_ar: 'مجال اللغة العربية', position: 1 },
      { id: 'dom-sc', name_fr: 'Sciences et technologie', name_ar: 'مجال العلوم والتكنولوجيا', position: 2 },
      { id: 'dom-ed', name_fr: 'Éducation (socialisation et arts)', name_ar: 'مجال التنشئة الإجتماعية والفنون', position: 3 },
      { id: 'dom-fl', name_fr: 'Langues étrangères', name_ar: 'مجال اللغات الأجنبية', position: 4 }
    ];
    this.domains.set(domainsData);

    const subjectsData: Subject[] = [
      // Arabe
      { id: 'sbj-ar-oral', domain_id: 'dom-ar', name_fr: 'Communication orale et récitation', name_ar: 'التواصل الشفوي والمحفوظات', is_foreign_language: false, position: 1 },
      { id: 'sbj-ar-read', domain_id: 'dom-ar', name_fr: 'Lecture', name_ar: 'القراءة', is_foreign_language: false, position: 2 },
      { id: 'sbj-ar-gram', domain_id: 'dom-ar', name_fr: 'Grammaire et écriture', name_ar: 'قواعد اللغة والخط', is_foreign_language: false, position: 3 },
      { id: 'sbj-ar-prod', domain_id: 'dom-ar', name_fr: 'Production écrite', name_ar: 'الإنتاج الكتابي', is_foreign_language: false, position: 4 },
      // Sciences
      { id: 'sbj-math', domain_id: 'dom-sc', name_fr: 'Mathématiques', name_ar: 'الرياضيات', is_foreign_language: false, position: 1 },
      { id: 'sbj-sci', domain_id: 'dom-sc', name_fr: 'Éveil scientifique', name_ar: 'الإيقاظ العلمي', is_foreign_language: false, position: 2 },
      { id: 'sbj-tech', domain_id: 'dom-sc', name_fr: 'Éducation technologique', name_ar: 'التربية التكنولوجية', is_foreign_language: false, position: 3 },
      // Socialisation & Arts
      { id: 'sbj-islam', domain_id: 'dom-ed', name_fr: 'Éducation islamique', name_ar: 'التربية الإسلامية', is_foreign_language: false, position: 1 },
      { id: 'sbj-hist', domain_id: 'dom-ed', name_fr: 'Histoire & Géographie', name_ar: 'التاريخ والجغرافيا', is_foreign_language: false, position: 2 },
      { id: 'sbj-art', domain_id: 'dom-ed', name_fr: 'Éducation plastique & musicale', name_ar: 'التربية التشكيلية والموسيقية', is_foreign_language: false, position: 3 },
      { id: 'sbj-sport', domain_id: 'dom-ed', name_fr: 'Éducation physique', name_ar: 'التربية البدنية', is_foreign_language: false, position: 4 },
      // Foreign languages
      { id: 'sbj-fr', domain_id: 'dom-fl', name_fr: 'Français', name_ar: 'الفرنسية', is_foreign_language: true, position: 1 },
      { id: 'sbj-en', domain_id: 'dom-fl', name_fr: 'Anglais', name_ar: 'الإنجليزية', is_foreign_language: true, position: 2 }
    ];
    this.subjects.set(subjectsData);

    // French sub-components matching schema.sql and SPEC.md
    const componentsData: SubjectComponent[] = [
      { id: 'cmp-fr-recit', subject_id: 'sbj-fr', name_fr: 'Récitation', name_ar: 'المحفوظات', max_score: 5, position: 1 },
      { id: 'cmp-fr-oral', subject_id: 'sbj-fr', name_fr: 'Expression orale', name_ar: 'التعبير الشفوي', max_score: 15, position: 2 },
      { id: 'cmp-fr-lect-voix', subject_id: 'sbj-fr', name_fr: 'Lecture à haute voix', name_ar: 'القراءة الجهرية', max_score: 6, position: 3 },
      { id: 'cmp-fr-lect-comp', subject_id: 'sbj-fr', name_fr: 'Lecture compréhension', name_ar: 'فهم المقروء', max_score: 14, position: 4 },
      { id: 'cmp-fr-gram', subject_id: 'sbj-fr', name_fr: 'Grammaire', name_ar: 'قواعد لغة', max_score: 10, position: 5 },
      { id: 'cmp-fr-conj', subject_id: 'sbj-fr', name_fr: 'Conjugaison', name_ar: 'تصريف أفعال', max_score: 10, position: 6 },
      { id: 'cmp-fr-orth', subject_id: 'sbj-fr', name_fr: 'Orthographe-dictée', name_ar: 'إملاء ورسم', max_score: 20, position: 7 },
      { id: 'cmp-fr-prod', subject_id: 'sbj-fr', name_fr: 'Production écrite', name_ar: 'إنتاج كتابي', max_score: 20, position: 8 }
    ];
    this.subjectComponents.set(componentsData);

    // Class Subjects for 3ème A
    const classSubjectsData: ClassSubject[] = [
      { id: 'cs-3a-fr', class_id: 'cls-3a', subject_id: 'sbj-fr', teacher_id: 'usr-teacher-1', teacher_name: 'Mme Salma Kallel', coefficient: 1.5, position: 1 },
      { id: 'cs-3a-en', class_id: 'cls-3a', subject_id: 'sbj-en', teacher_id: 'usr-teacher-1', teacher_name: 'Mme Salma Kallel', coefficient: 1.0, position: 2 },
      { id: 'cs-3a-ar-read', class_id: 'cls-3a', subject_id: 'sbj-ar-read', teacher_id: 'usr-teacher-1', teacher_name: 'Mme Salma Kallel', coefficient: 1.0, position: 3 },
      { id: 'cs-3a-ar-prod', class_id: 'cls-3a', subject_id: 'sbj-ar-prod', teacher_id: 'usr-teacher-1', teacher_name: 'Mme Salma Kallel', coefficient: 1.0, position: 4 },
      { id: 'cs-3a-math', class_id: 'cls-3a', subject_id: 'sbj-math', teacher_id: 'usr-teacher-2', teacher_name: 'M. Sami Bouazizi', coefficient: 2.0, position: 5 },
      { id: 'cs-3a-sci', class_id: 'cls-3a', subject_id: 'sbj-sci', teacher_id: 'usr-teacher-2', teacher_name: 'M. Sami Bouazizi', coefficient: 1.5, position: 6 },
      { id: 'cs-3a-islam', class_id: 'cls-3a', subject_id: 'sbj-islam', teacher_id: 'usr-teacher-2', teacher_name: 'M. Sami Bouazizi', coefficient: 1.0, position: 7 },
      { id: 'cs-3a-sport', class_id: 'cls-3a', subject_id: 'sbj-sport', teacher_id: 'usr-teacher-2', teacher_name: 'M. Sami Bouazizi', coefficient: 1.0, position: 8 }
    ];
    this.classSubjects.set(classSubjectsData);

    // Detailed Report Cards for Youssef Ben Amor (Trimester 1)
    const youssefReportCard: ReportCard = {
      id: 'rc-youssef-t1-official',
      student_id: 'std-youssef',
      class_id: 'cls-3a',
      trimester: 1,
      kind: 'official',
      status: 'published',
      general_average: 16.85,
      class_max_average: 18.20,
      class_min_average: 11.40,
      behavior_remarks: 'Élève très attentif, curieux et bienveillant. Excellent travail ce trimestre.',
      mention: 'Tableau d’Honneur avec Félicitations du Conseil',
      published_at: '2026-12-20T10:00:00Z',
      content: {
        student_first_name: 'Youssef',
        student_last_name: 'Ben Amor',
        student_first_name_ar: 'يوسف',
        student_last_name_ar: 'بن عمر',
        class_name: '3ème A',
        school_year: '2026-2027',
        headmaster_remarks: 'Bravo Youssef pour ce trimestre remarquable ! Continue sur cette voie exemplaire.',
        domains: [
          {
            domain_id: 'dom-ar',
            name_fr: 'Langue arabe',
            name_ar: 'مجال اللغة العربية',
            domain_average: 16.50,
            recommendations: 'Très bonne participation orale et écriture soignée.',
            subjects: [
              { subject_id: 'sbj-ar-read', name_fr: 'Lecture', name_ar: 'القراءة', coefficient: 1.0, score_20: 17.0, class_max: 18.5, class_min: 12.0 },
              { subject_id: 'sbj-ar-prod', name_fr: 'Production écrite', name_ar: 'الإنتاج الكتابي', coefficient: 1.0, score_20: 16.0, class_max: 17.5, class_min: 10.5 }
            ]
          },
          {
            domain_id: 'dom-sc',
            name_fr: 'Sciences et technologie',
            name_ar: 'مجال العلوم والتكنولوجيا',
            domain_average: 17.50,
            recommendations: 'Excellente logique mathématique et grand intérêt scientifique.',
            subjects: [
              { subject_id: 'sbj-math', name_fr: 'Mathématiques', name_ar: 'الرياضيات', coefficient: 2.0, score_20: 18.0, class_max: 19.5, class_min: 11.0 },
              { subject_id: 'sbj-sci', name_fr: 'Éveil scientifique', name_ar: 'الإيقاظ العلمي', coefficient: 1.5, score_20: 17.0, class_max: 18.0, class_min: 12.0 }
            ]
          },
          {
            domain_id: 'dom-ed',
            name_fr: 'Éducation (socialisation et arts)',
            name_ar: 'مجال التنشئة والفنون',
            domain_average: 17.00,
            recommendations: 'Comportement exemplaire et bel esprit d’équipe.',
            subjects: [
              { subject_id: 'sbj-islam', name_fr: 'Éducation islamique', name_ar: 'التربية الإسلامية', coefficient: 1.0, score_20: 17.5, class_max: 19.0, class_min: 13.0 },
              { subject_id: 'sbj-sport', name_fr: 'Éducation physique', name_ar: 'التربية البدنية', coefficient: 1.0, score_20: 16.5, class_max: 18.0, class_min: 14.0 }
            ]
          },
          {
            domain_id: 'dom-fl',
            name_fr: 'Langues étrangères',
            name_ar: 'مجال اللغات الأجنبية',
            domain_average: 16.20,
            recommendations: 'Très bonne diction en français et anglais. Vocabulaire riche.',
            subjects: [
              { subject_id: 'sbj-fr', name_fr: 'Français', name_ar: 'الفرنسية', coefficient: 1.5, score_20: 16.4, class_max: 18.0, class_min: 10.0 },
              { subject_id: 'sbj-en', name_fr: 'Anglais', name_ar: 'الإنجليزية', coefficient: 1.0, score_20: 16.0, class_max: 18.5, class_min: 11.0 }
            ]
          }
        ]
      }
    };

    // Detailed Foreign Languages Sheet for Youssef
    const youssefLanguagesSheet: ReportCard = {
      id: 'rc-youssef-t1-languages',
      student_id: 'std-youssef',
      class_id: 'cls-3a',
      trimester: 1,
      kind: 'languages',
      status: 'published',
      published_at: '2026-12-20T10:00:00Z',
      content: {
        student_first_name: 'Youssef',
        student_last_name: 'Ben Amor',
        student_first_name_ar: 'يوسف',
        student_last_name_ar: 'بن عمر',
        class_name: '3ème A',
        school_year: '2026-2027',
        languages_details: [
          {
            subject_id: 'sbj-fr',
            subject_name_fr: 'Français',
            subject_name_ar: 'اللغة الفرنسية',
            coefficient: 1.5,
            components: [
              { component_name_fr: 'Récitation', max_score: 5, score: 5.0 },
              { component_name_fr: 'Expression orale', max_score: 15, score: 13.5 },
              { component_name_fr: 'Lecture à haute voix', max_score: 6, score: 5.5 },
              { component_name_fr: 'Lecture compréhension', max_score: 14, score: 12.0 },
              { component_name_fr: 'Grammaire', max_score: 10, score: 8.5 },
              { component_name_fr: 'Conjugaison', max_score: 10, score: 8.0 },
              { component_name_fr: 'Orthographe-dictée', max_score: 20, score: 15.5 },
              { component_name_fr: 'Production écrite', max_score: 20, score: 14.0 }
            ],
            total_score: 82.0,
            total_max: 100.0,
            final_score_20: 16.4,
            teacher_observation: 'Excellente récitation poétique et expression fluide. Soigner la terminaison au passé composé.'
          },
          {
            subject_id: 'sbj-en',
            subject_name_fr: 'Anglais (English)',
            subject_name_ar: 'اللغة الإنجليزية',
            coefficient: 1.0,
            components: [
              { component_name_fr: 'Listening & Speaking', max_score: 10, score: 8.5 },
              { component_name_fr: 'Reading comprehension', max_score: 5, score: 4.0 },
              { component_name_fr: 'Writing & Vocabulary', max_score: 5, score: 3.5 }
            ],
            total_score: 16.0,
            total_max: 20.0,
            final_score_20: 16.0,
            teacher_observation: 'Very lively participation! Good grasp of daily conversation vocabulary.'
          }
        ]
      }
    };

    this.reportCards.set([youssefReportCard, youssefLanguagesSheet]);

    // Attendance
    const attendanceData: AttendanceRecord[] = [
      {
        id: 'att-1',
        student_id: 'std-youssef',
        student_name: 'Youssef Ben Amor',
        class_id: 'cls-3a',
        day: '2026-11-04',
        status: 'absent',
        justification: {
          id: 'jst-1',
          attendance_id: 'att-1',
          parent_id: 'usr-parent-1',
          reason: 'Grippe saisonnière avec forte fièvre, certificat médical présenté.',
          created_at: '2026-11-04T12:00:00Z'
        }
      },
      {
        id: 'att-2',
        student_id: 'std-youssef',
        student_name: 'Youssef Ben Amor',
        class_id: 'cls-3a',
        day: '2026-10-18',
        status: 'late'
      },
      {
        id: 'att-3',
        student_id: 'std-youssef',
        student_name: 'Youssef Ben Amor',
        class_id: 'cls-3a',
        day: '2026-11-12',
        status: 'present'
      },
      {
        id: 'att-4',
        student_id: 'std-mariem',
        student_name: 'Mariem Ben Amor',
        class_id: 'cls-1a',
        day: '2026-11-12',
        status: 'present'
      }
    ];
    this.attendance.set(attendanceData);

    // Homework items
    const homeworkData: HomeworkItem[] = [
      {
        id: 'hw-1',
        class_id: 'cls-3a',
        class_name: '3ème A',
        class_subject_id: 'cs-3a-fr',
        subject_name: 'Français',
        subject_name_ar: 'الفرنسية',
        teacher_id: 'usr-teacher-1',
        teacher_name: 'Mme Salma Kallel',
        title: 'Lecture : Conte du Petit Chaperon Rouge',
        description: 'Lire attentivement les pages 24 et 25 du manuel. Répondre aux questions 1, 2 et 3 sur le cahier de maison.',
        due_date: '2026-11-16',
        is_done: false,
        created_at: '2026-11-12T10:00:00Z'
      },
      {
        id: 'hw-2',
        class_id: 'cls-3a',
        class_name: '3ème A',
        class_subject_id: 'cs-3a-math',
        subject_name: 'Mathématiques',
        subject_name_ar: 'الرياضيات',
        teacher_id: 'usr-teacher-2',
        teacher_name: 'M. Sami Bouazizi',
        title: 'Exercices sur la multiplication posée',
        description: 'Résoudre les opérations de la page 42 (Exercices A et B). Vérifier les résultats avec les tables de 6 et 7.',
        due_date: '2026-11-17',
        is_done: true,
        created_at: '2026-11-11T14:30:00Z'
      },
      {
        id: 'hw-3',
        class_id: 'cls-3a',
        class_name: '3ème A',
        class_subject_id: 'cs-3a-sci',
        subject_name: 'Éveil scientifique',
        subject_name_ar: 'الإيقاظ العلمي',
        teacher_id: 'usr-teacher-2',
        teacher_name: 'M. Sami Bouazizi',
        title: 'Les états de l’eau et le cycle hydrologique',
        description: 'Dessiner sur une feuille à dessin le cycle de l’eau (évaporation, condensation, précipitations).',
        due_date: '2026-11-20',
        is_done: false,
        created_at: '2026-11-13T09:00:00Z'
      },
      {
        id: 'hw-4',
        class_id: 'cls-2a',
        class_name: '2ème A',
        class_subject_id: 'cs-2a-fr',
        subject_name: 'Français',
        subject_name_ar: 'الفرنسية',
        teacher_id: 'usr-teacher-1',
        teacher_name: 'Mme Salma Kallel',
        title: 'Lecture et compréhension du texte',
        description: 'Relire le texte de la leçon 3 et répondre aux questions 1 à 4.',
        due_date: '2026-11-18',
        is_done: false,
        created_at: '2026-11-14T09:00:00Z'
      },
      {
        id: 'hw-5',
        class_id: 'cls-6f',
        class_name: '6ème F',
        class_subject_id: 'cs-6f-math',
        subject_name: 'Mathématiques',
        subject_name_ar: 'الرياضيات',
        teacher_id: 'usr-teacher-2',
        teacher_name: 'M. Sami Bouazizi',
        title: 'Exercices de fractions et simplification',
        description: 'Compléter les 6 premières opérations de la fiche de travail et vérifier les résultats.',
        due_date: '2026-11-19',
        is_done: true,
        created_at: '2026-11-13T15:30:00Z'
      }
    ];
    this.homework.set(homeworkData);

    // Timetable slots
    const timetableData: TimetableSlot[] = [
      { id: 'tt-1', class_id: 'cls-3a', subject_name: 'Français', subject_name_ar: 'الفرنسية', teacher_name: 'Mme Salma Kallel', weekday: 1, starts_at: '08:30', ends_at: '10:00', room: 'Salle 12' },
      { id: 'tt-2', class_id: 'cls-3a', subject_name: 'Mathématiques', subject_name_ar: 'الرياضيات', teacher_name: 'M. Sami Bouazizi', weekday: 1, starts_at: '10:15', ends_at: '12:00', room: 'Salle 12' },
      { id: 'tt-3', class_id: 'cls-3a', subject_name: 'Lecture Arabe', subject_name_ar: 'القراءة', teacher_name: 'Mme Salma Kallel', weekday: 2, starts_at: '08:30', ends_at: '10:00', room: 'Salle 12' },
      { id: 'tt-4', class_id: 'cls-3a', subject_name: 'Éveil scientifique', subject_name_ar: 'الإيقاظ العلمي', teacher_name: 'M. Sami Bouazizi', weekday: 2, starts_at: '10:15', ends_at: '12:00', room: 'Labo 1' },
      { id: 'tt-5', class_id: 'cls-3a', subject_name: 'Anglais', subject_name_ar: 'الإنجليزية', teacher_name: 'Mme Salma Kallel', weekday: 3, starts_at: '08:30', ends_at: '10:00', room: 'Salle 12' },
      { id: 'tt-6', class_id: 'cls-3a', subject_name: 'Éducation physique', subject_name_ar: 'التربية البدنية', teacher_name: 'M. Sami Bouazizi', weekday: 3, starts_at: '10:15', ends_at: '12:00', room: 'Terrain de sport' },
      { id: 'tt-7', class_id: 'cls-3a', subject_name: 'Mathématiques', subject_name_ar: 'الرياضيات', teacher_name: 'M. Sami Bouazizi', weekday: 4, starts_at: '08:30', ends_at: '10:00', room: 'Salle 12' },
      { id: 'tt-8', class_id: 'cls-3a', subject_name: 'Production écrite', subject_name_ar: 'الإنتاج الكتابي', teacher_name: 'Mme Salma Kallel', weekday: 4, starts_at: '10:15', ends_at: '12:00', room: 'Salle 12' },
      { id: 'tt-9', class_id: 'cls-3a', subject_name: 'Français (Dictée/Grammaire)', subject_name_ar: 'الفرنسية', teacher_name: 'Mme Salma Kallel', weekday: 5, starts_at: '08:30', ends_at: '10:00', room: 'Salle 12' },
      { id: 'tt-10', class_id: 'cls-3a', subject_name: 'Arts plastiques', subject_name_ar: 'التربية التشكيلية', teacher_name: 'M. Sami Bouazizi', weekday: 5, starts_at: '10:15', ends_at: '12:00', room: 'Atelier Art' },
      { id: 'tt-11', class_id: 'cls-2a', subject_name: 'Lecture & écriture', subject_name_ar: 'القراءة والكتابة', teacher_name: 'Mme Salma Kallel', weekday: 1, starts_at: '08:30', ends_at: '10:00', room: 'Salle 8' },
      { id: 'tt-12', class_id: 'cls-2a', subject_name: 'Mathématiques', subject_name_ar: 'الرياضيات', teacher_name: 'M. Sami Bouazizi', weekday: 2, starts_at: '09:00', ends_at: '10:30', room: 'Salle 8' },
      { id: 'tt-13', class_id: 'cls-6f', subject_name: 'Français', subject_name_ar: 'الفرنسية', teacher_name: 'Mme Salma Kallel', weekday: 1, starts_at: '08:00', ends_at: '09:30', room: 'Salle 21' },
      { id: 'tt-14', class_id: 'cls-6f', subject_name: 'Sciences', subject_name_ar: 'العلوم', teacher_name: 'M. Sami Bouazizi', weekday: 3, starts_at: '10:00', ends_at: '11:30', room: 'Labo 3' }
    ];
    this.timetableSlots.set(timetableData);

    // School Events Calendar
    const eventsData: EventItem[] = [
      { id: 'evt-1', title: 'Vacances de mi-trimestre d’automne', description: 'Reprise des cours le lundi suivant.', starts_at: '2026-11-01', ends_at: '2026-11-08', all_day: true, category: 'vacances' },
      { id: 'evt-2', title: 'Examens écrits du 1er Trimestre', description: 'Épreuves synthèse selon le calendrier par classe.', starts_at: '2026-12-08', ends_at: '2026-12-15', all_day: true, category: 'examen' },
      { id: 'evt-3', title: 'Journée portes ouvertes et Fête de fin d’année', description: 'Remise des bulletins et spectacle des enfants.', starts_at: '2026-12-22T09:00:00Z', ends_at: '2026-12-22T13:00:00Z', all_day: false, category: 'fete' }
    ];
    this.events.set(eventsData);

    // News / Actualités de l'école (Homepage Feed)
    const newsData: NewsItem[] = [
      {
        id: 'news-1',
        title_fr: 'Sortie pédagogique au Musée Océanographique de Monastir 🌊',
        title_ar: 'زيارة استكشافية إلى المتحف البحري بالمنستير 🌊',
        body_fr: 'Nos élèves des classes de 3ème et 4ème année ont visité le musée océanographique. Une journée riche en découvertes marines et émerveillement scientifique !',
        body_ar: 'قام تلاميذ السنتين الثالثة والرابعة برحلة استكشافية رائعة إلى المتحف البحري، تخللتها ورشات علمية ممتعة حول التنوع البيولوجي.',
        category: 'trip',
        cover_path: 'assets/logo.jpg',
        pinned: true,
        published: true,
        publish_at: '2026-11-10T08:00:00Z',
        created_at: '2026-11-10T08:00:00Z'
      },
      {
        id: 'news-2',
        title_fr: 'Célébration de la Journée du Savoir et de la Lecture 📚',
        title_ar: 'الاحتفال بيوم العلم وشغف المطالعة 📚',
        body_fr: 'Ateliers de lecture bilingue, contes pour enfants et exposition de dessins. Bravo à nos petits lecteurs passionnés pour leurs magnifiques créations !',
        body_ar: 'ورشات قراءة ثنائية اللغة، حكايات للأطفال ومعرض رسومات. هنيئاً لقراء المستقبل الصغار على إبداعهم وتميزهم!',
        category: 'celebration',
        cover_path: 'assets/logo.jpg',
        pinned: false,
        published: true,
        publish_at: '2026-11-05T09:00:00Z',
        created_at: '2026-11-05T09:00:00Z'
      },
      {
        id: 'news-3',
        title_fr: 'Rappel : Calendrier des épreuves du 1er Trimestre',
        title_ar: 'تذكير : روزنامة الاختبارات التأليفية للثلاثي الأول',
        body_fr: 'Les épreuves synthétiques débuteront le 8 décembre. L’emploi du temps spécifique sera distribué cette semaine par les enseignants.',
        body_ar: 'تنطلق الاختبارات التأليفية للثلاثي الأول يوم 8 ديسمبر القادم. سيتم تسليم الجداول المفصلة لكل قسم هذا الأسبوع.',
        category: 'reminder',
        cover_path: 'assets/logo.jpg',
        pinned: false,
        published: true,
        publish_at: '2026-11-12T14:00:00Z',
        created_at: '2026-11-12T14:00:00Z'
      }
    ];
    this.news.set(newsData);

    // Fees & Payments in TND (3 decimals)
    const feesData: Fee[] = [
      {
        id: 'fee-1',
        student_id: 'std-youssef',
        student_name: 'Youssef Ben Amor',
        class_name: '3ème A',
        school_year_id: currentYear.id,
        label: 'Frais d’inscription & Assurance scolaire',
        amount: 350.000,
        due_date: '2026-09-15',
        status: 'paid',
        paid_amount: 350.000,
        paid_at: '2026-09-10',
        method: 'cash',
        reference: 'REC-2026-0089',
        created_at: '2026-09-01T00:00:00Z'
      },
      {
        id: 'fee-2',
        student_id: 'std-youssef',
        student_name: 'Youssef Ben Amor',
        class_name: '3ème A',
        school_year_id: currentYear.id,
        label: 'Cantine scolaire (Octobre & Novembre)',
        amount: 280.000,
        due_date: '2026-10-15',
        status: 'paid',
        paid_amount: 280.000,
        paid_at: '2026-10-12',
        method: 'cash',
        reference: 'REC-2026-0154',
        receipt_path: 'receipts/std-youssef/fee-2.pdf',
        recorded_by_name: 'M. Nizar Chaabane (Économe)',
        created_at: '2026-09-01T08:00:00Z'
      },
      {
        id: 'fee-3',
        student_id: 'std-youssef',
        student_name: 'Youssef Ben Amor',
        class_name: '3ème A',
        school_year_id: currentYear.id,
        label: 'Scolarité - 2ème Trimestre',
        amount: 1200.000,
        due_date: '2027-01-05',
        status: 'pending',
        created_at: '2026-09-01T08:00:00Z'
      },
      {
        id: 'fee-4',
        student_id: 'std-youssef',
        student_name: 'Youssef Ben Amor',
        class_name: '3ème A',
        school_year_id: currentYear.id,
        label: 'Activité Robotique & Club Sciences',
        amount: 90.000,
        due_date: '2026-11-01',
        status: 'pending', // Will show as Overdue!
        created_at: '2026-10-15T08:00:00Z'
      },
      // Fees for Mariem
      {
        id: 'fee-5',
        student_id: 'std-mariem',
        student_name: 'Mariem Ben Amor',
        class_name: '1ère A',
        school_year_id: currentYear.id,
        label: 'Frais d’inscription 1ère année',
        amount: 350.000,
        due_date: '2026-09-15',
        status: 'paid',
        paid_amount: 350.000,
        paid_at: '2026-09-10',
        method: 'cash',
        reference: 'REC-2026-0090',
        receipt_path: 'receipts/std-mariem/fee-5.pdf',
        recorded_by_name: 'M. Nizar Chaabane (Économe)',
        created_at: '2026-09-01T08:00:00Z'
      },
      {
        id: 'fee-6',
        student_id: 'std-mariem',
        student_name: 'Mariem Ben Amor',
        class_name: '1ère A',
        school_year_id: currentYear.id,
        label: 'Scolarité 1ère année - 1er Trimestre',
        amount: 1100.000,
        due_date: '2026-10-05',
        status: 'paid',
        paid_amount: 1100.000,
        paid_at: '2026-10-02',
        method: 'cheque',
        reference: 'CHQ-BIAT-4521891',
        receipt_path: 'receipts/std-mariem/fee-6.pdf',
        recorded_by_name: 'M. Nizar Chaabane (Économe)',
        created_at: '2026-09-01T08:00:00Z'
      }
    ];
    this.fees.set(feesData);

    const annexPlansData: AnnexServicePlan[] = [
      {
        id: 'svc-bus',
        type: 'bus',
        label: 'Transport scolaire',
        description: 'Transport domicile-école et activités scolaires.',
        amount: 180,
        active: true,
        created_at: '2026-09-01T08:00:00Z'
      },
      {
        id: 'svc-garderie',
        type: 'garderie',
        label: 'Garderie du matin / soir',
        description: 'Accueil, encadrement et surveillance.',
        amount: 120,
        active: true,
        created_at: '2026-09-01T08:00:00Z'
      },
      {
        id: 'svc-etude',
        type: 'etude',
        label: 'Étude supplémentaire',
        description: 'Accompagnement pédagogique et devoirs supervisés.',
        amount: 150,
        active: true,
        created_at: '2026-09-01T08:00:00Z'
      }
    ];
    this.annexServicePlans.set(annexPlansData);

    const serviceEnrollmentsData: ServiceEnrollment[] = [
      {
        id: 'svc-enr-1',
        student_id: 'std-yakine-chaabane',
        student_name: 'Yakine Chaabane',
        parent_id: 'usr-parent-1',
        service_type: 'bus',
        service_label: 'Transport scolaire',
        amount: 180,
        status: 'active',
        start_date: '2026-09-01',
        created_at: '2026-09-01T08:00:00Z'
      },
      {
        id: 'svc-enr-2',
        student_id: 'std-elae-chaabane',
        student_name: 'Elae Errahmene Chaabane',
        parent_id: 'usr-parent-1',
        service_type: 'etude',
        service_label: 'Étude supplémentaire',
        amount: 150,
        status: 'active',
        start_date: '2026-09-11',
        created_at: '2026-09-11T08:00:00Z'
      }
    ];
    this.serviceEnrollments.set(serviceEnrollmentsData);

    const financialMovementsData: FinancialMovement[] = [
      {
        id: 'fin-1',
        type: 'income',
        category: 'scolarite',
        label: 'Scolarité - 1er trimestre',
        amount: 1200,
        student_id: 'std-youssef',
        student_name: 'Youssef Ben Amor',
        method: 'cheque',
        reference: 'CHQ-BIAT-4521890',
        created_at: '2026-10-02T09:00:00Z'
      },
      {
        id: 'fin-2',
        type: 'income',
        category: 'bus',
        label: 'Transport scolaire',
        amount: 180,
        student_id: 'std-yakine-chaabane',
        student_name: 'Yakine Chaabane',
        method: 'cash',
        reference: 'SRV-1',
        created_at: '2026-09-05T08:30:00Z'
      },
      {
        id: 'fin-3',
        type: 'income',
        category: 'garderie',
        label: 'Garderie du matin / soir',
        amount: 120,
        student_id: 'std-elae-chaabane',
        student_name: 'Elae Errahmene Chaabane',
        method: 'transfer',
        reference: 'TRF-6382',
        created_at: '2026-09-12T10:00:00Z'
      },
      {
        id: 'fin-4',
        type: 'expense',
        category: 'bus',
        label: 'Entretien du transport scolaire',
        amount: 420,
        method: 'cash',
        reference: 'FUEL-11',
        created_at: '2026-10-10T12:00:00Z'
      }
    ];
    this.financialMovements.set(financialMovementsData);

    // Appointments (Parent <-> Teacher)
    const appointmentsData: Appointment[] = [
      {
        id: 'appt-1',
        parent_id: 'usr-parent-1',
        parent_name: 'Ahmed Ben Amor',
        parent_phone: '+216 98 123 456',
        student_id: 'std-youssef',
        student_name: 'Youssef Ben Amor',
        class_id: 'cls-3a',
        class_name: '3ème A',
        teacher_id: 'usr-teacher-1',
        teacher_name: 'Mme Salma Kallel',
        subject_name: 'Français',
        reason: 'Évolution de la lecture et participation en classe',
        note: 'Nous aimerions faire le point sur ses progrès et obtenir quelques conseils de lecture pour les vacances.',
        preferred_slots: 'Mardi après-midi à partir de 14h ou Vendredi matin',
        status: 'confirmed',
        confirmed_start: '2026-11-18T14:30:00Z',
        confirmed_end: '2026-11-18T15:00:00Z',
        location: 'Bureau des entretiens pédagogiques (RDC)',
        created_at: '2026-11-10T11:00:00Z'
      },
      {
        id: 'appt-2',
        parent_id: 'usr-parent-1',
        parent_name: 'Ahmed Ben Amor',
        parent_phone: '+216 98 123 456',
        student_id: 'std-youssef',
        student_name: 'Youssef Ben Amor',
        class_id: 'cls-3a',
        class_name: '3ème A',
        teacher_id: 'usr-teacher-2',
        teacher_name: 'M. Sami Bouazizi',
        subject_name: 'Mathématiques',
        reason: 'Préparation du concours de calcul mental',
        note: 'Souhait d’encourager Youssef pour le club de mathématiques.',
        preferred_slots: 'Jeudi après-midi',
        status: 'alternatives_proposed',
        proposals: [
          { id: 'prp-1', appointment_id: 'appt-2', starts_at: '2026-11-20T11:00:00Z', ends_at: '2026-11-20T11:30:00Z' },
          { id: 'prp-2', appointment_id: 'appt-2', starts_at: '2026-11-21T15:30:00Z', ends_at: '2026-11-21T16:00:00Z' }
        ],
        created_at: '2026-11-12T16:00:00Z'
      }
    ];
    this.appointments.set(appointmentsData);

    // Pending Parent Link Requests (for Admin review)
    const linkRequestsData: LinkRequest[] = [
      {
        id: 'lr-1',
        parent_id: 'usr-parent-new-1',
        parent_name: 'Monia Khemir',
        parent_phone: '+216 97 888 999',
        parent_email: 'monia.khemir@gmail.com',
        child_first_name: 'Adam',
        child_last_name: 'Trabelsi',
        declared_class_id: 'cls-3a',
        declared_class_name: '3ème A',
        student_id: 'std-adam',
        status: 'pending',
        created_at: '2026-11-13T09:15:00Z'
      },
      {
        id: 'lr-2',
        parent_id: 'usr-parent-new-2',
        parent_name: 'Karim Mansour',
        parent_phone: '+216 55 444 333',
        parent_email: 'karim.mansour@yahoo.fr',
        child_first_name: 'Rayen',
        child_last_name: 'Mansour',
        declared_class_id: 'cls-3a',
        declared_class_name: '3ème A',
        status: 'pending',
        created_at: '2026-11-13T10:45:00Z'
      }
    ];
    this.linkRequests.set(linkRequestsData);

    // Notifications
    const notificationsData: NotificationItem[] = [
      {
        id: 'notif-1',
        user_id: 'usr-parent-1',
        type: 'grade_published',
        title: 'Bulletin du 1er Trimestre disponible !',
        body: 'Le bulletin officiel de Youssef Ben Amor (3ème A) a été validé et publié.',
        created_at: '2026-11-13T08:00:00Z'
      },
      {
        id: 'notif-2',
        user_id: 'usr-parent-1',
        type: 'appointment_confirmed',
        title: 'Rendez-vous confirmé avec Mme Salma Kallel',
        body: 'Le rendez-vous est prévu le Mardi 18 Novembre à 14h30 en Salle des entretiens.',
        created_at: '2026-11-12T17:00:00Z'
      },
      {
        id: 'notif-3',
        user_id: 'usr-parent-1',
        type: 'fee_reminder',
        title: 'Rappel de paiement : Club Robotique',
        body: 'Le montant de 90.000 DT pour l’activité Robotique est arrivé à échéance.',
        created_at: '2026-11-10T09:00:00Z'
      }
    ];
    this.notifications.set(notificationsData);

    this.saveToStorage();
  }
}
