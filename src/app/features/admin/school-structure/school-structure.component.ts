import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { I18nService } from '../../../core/services/i18n.service';
import { SchoolDataService } from '../../../core/services/school-data.service';
import { ApiClass, ApiStudent, ClassInput, SchoolApiService, StudentInput } from '../../../core/services/school-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { STAFF_ROLE_LABELS, StaffApiService, StaffInput, StaffMember, StaffRole } from '../../../core/services/staff-api.service';
import { ChildLink, ParentAccount, ParentChild, ParentInput, ParentsApiService, RELATIONSHIP_LABELS, Relationship } from '../../../core/services/parents-api.service';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

type StructureTab = 'students' | 'parents' | 'staff' | 'classes' | 'subjects' | 'levels';

@Component({
  selector: 'app-school-structure',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './school-structure.component.html',
  styleUrls: ['./school-structure.component.scss']
})
export class SchoolStructureComponent implements OnInit {
  selectedTab: StructureTab = 'students';

  levelForm = {
    code: '',
    name_fr: '',
    name_ar: '',
    position: 1
  };

  levelEditForm = {
    id: '',
    code: '',
    name_fr: '',
    name_ar: '',
    position: 1
  };

  subjectForm = {
    domain_id: 'dom-ar',
    name_fr: '',
    name_ar: '',
    is_foreign_language: false,
    position: 1
  };

  subjectEditForm = {
    id: '',
    domain_id: 'dom-ar',
    name_fr: '',
    name_ar: '',
    is_foreign_language: false,
    position: 1
  };

  // ------------------------------------------------ students & classes (API)

  readonly api = inject(SchoolApiService);

  /** Which form is busy, so only that button shows a spinner. */
  readonly busy = signal<'student' | 'class' | `del-${string}` | null>(null);
  readonly studentError = signal<string | null>(null);
  readonly classError = signal<string | null>(null);
  readonly notice = signal('');
  readonly studentFilter = signal('');
  readonly classFilter = signal('');

  studentForm = this.emptyStudentForm();
  editingStudentId: string | null = null;
  classForm = this.emptyClassForm();
  editingClassId: string | null = null;

  readonly filteredStudents = computed(() => {
    const query = normalize(this.studentFilter());
    const classId = this.classFilter();
    return this.api.students().filter(s =>
      (!classId || s.class_id === classId) &&
      (!query || normalize(`${s.first_name} ${s.last_name} ${s.first_name_ar ?? ''} ${s.last_name_ar ?? ''}`).includes(query))
    );
  });

  /** Classes ordered by level position, then by name. */
  readonly sortedClasses = computed(() => {
    const position = new Map(this.schoolData.levels().map(l => [l.id, l.position]));
    return [...this.api.classes()].sort((a, b) =>
      (position.get(a.level_id ?? '') ?? 99) - (position.get(b.level_id ?? '') ?? 99) || a.name.localeCompare(b.name, 'fr'));
  });

  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor(
    public i18n: I18nService,
    public schoolData: SchoolDataService
  ) {}

  ngOnInit(): void {
    void this.api.load();
    void this.staffApi.load();
    void this.parentsApi.load();
  }

  reload(): void {
    void this.api.load();
    void this.staffApi.load();
    void this.parentsApi.load();
  }

  async saveStudent(): Promise<void> {
    const form = this.studentForm;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.classId) {
      this.studentError.set('Prénom, nom et classe sont obligatoires.');
      return;
    }
    this.busy.set('student');
    this.studentError.set(null);
    try {
      if (this.editingStudentId) {
        const s = await this.api.updateStudent(this.editingStudentId, form);
        this.flash(`${s.first_name} ${s.last_name} a été mis(e) à jour.`);
      } else {
        const s = await this.api.createStudent(form);
        this.flash(`${s.first_name} ${s.last_name} a été ajouté(e) en ${s.class_name}.`);
      }
      this.cancelStudentEdit();
    } catch (error) {
      this.studentError.set((error as Error).message);
    } finally {
      this.busy.set(null);
    }
  }

  editStudent(student: ApiStudent): void {
    this.editingStudentId = student.id;
    this.studentError.set(null);
    this.studentForm = {
      firstName: student.first_name,
      lastName: student.last_name,
      firstNameAr: student.first_name_ar ?? '',
      lastNameAr: student.last_name_ar ?? '',
      gender: student.gender ?? 'F',
      classId: student.class_id ?? ''
    };
  }

  cancelStudentEdit(): void {
    this.editingStudentId = null;
    this.studentForm = this.emptyStudentForm(this.studentForm.classId);
    this.studentError.set(null);
  }

  async removeStudent(student: ApiStudent): Promise<void> {
    const ok = window.confirm(
      `Supprimer définitivement ${student.first_name} ${student.last_name} ?\nSes rattachements parents seront aussi supprimés.`);
    if (!ok) return;
    this.busy.set(`del-${student.id}`);
    try {
      await this.api.deleteStudent(student.id);
      if (this.editingStudentId === student.id) this.cancelStudentEdit();
      this.flash(`${student.first_name} ${student.last_name} a été supprimé(e).`);
    } catch (error) {
      this.studentError.set((error as Error).message);
    } finally {
      this.busy.set(null);
    }
  }

  async saveClass(): Promise<void> {
    const form = this.classForm;
    if (!form.name.trim() || !form.levelId) {
      this.classError.set('Le nom et le niveau sont obligatoires.');
      return;
    }
    this.busy.set('class');
    this.classError.set(null);
    try {
      const input = { name: form.name, levelId: form.levelId, teacherIds: form.teacherIds };
      const cls = this.editingClassId
        ? await this.api.updateClass(this.editingClassId, input)
        : await this.api.createClass(input);
      this.flash(this.editingClassId ? `La classe ${cls.name} a été mise à jour.` : `La classe ${cls.name} a été créée.`);
      this.cancelClassEdit();
    } catch (error) {
      this.classError.set((error as Error).message);
    } finally {
      this.busy.set(null);
    }
  }

  editClass(cls: ApiClass): void {
    this.editingClassId = cls.id;
    this.classError.set(null);
    this.classForm = { name: cls.name, levelId: cls.level_id ?? '', teacherIds: cls.teachers.map(t => t.id) };
  }

  cancelClassEdit(): void {
    this.editingClassId = null;
    this.classForm = this.emptyClassForm();
    this.classError.set(null);
  }

  toggleTeacher(teacherId: string, checked: boolean): void {
    const ids = this.classForm.teacherIds.filter(id => id !== teacherId);
    this.classForm.teacherIds = checked ? [...ids, teacherId] : ids;
  }

  async removeClass(cls: ApiClass): Promise<void> {
    if (cls.student_count > 0) {
      this.classError.set(`La classe ${cls.name} contient encore ${cls.student_count} élève(s). Changez-les de classe avant de la supprimer.`);
      return;
    }
    if (!window.confirm(`Supprimer la classe ${cls.name} ?`)) return;
    this.busy.set(`del-${cls.id}`);
    try {
      await this.api.deleteClass(cls.id);
      if (this.editingClassId === cls.id) this.cancelClassEdit();
      this.flash(`La classe ${cls.name} a été supprimée.`);
    } catch (error) {
      this.classError.set((error as Error).message);
    } finally {
      this.busy.set(null);
    }
  }

  showStudentsOf(cls: ApiClass): void {
    this.classFilter.set(cls.id);
    this.studentFilter.set('');
    this.setTab('students');
  }

  private flash(message: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set(message);
    this.noticeTimer = setTimeout(() => this.notice.set(''), 4000);
  }

  private emptyStudentForm(classId = ''): StudentInput {
    return { firstName: '', lastName: '', firstNameAr: '', lastNameAr: '', gender: 'F', classId };
  }

  private emptyClassForm(): ClassInput {
    return { name: '', levelId: '', teacherIds: [] };
  }

  // --------------------------------------------------- other tabs (local data)

  setTab(tab: StructureTab) {
    this.selectedTab = tab;
    // Children names / classes may have changed in the other tabs.
    if (tab === 'parents' && this.parentsApi.loaded()) void this.parentsApi.load();
  }

  // ---------------------------------------------------------- parents (API)

  readonly parentsApi = inject(ParentsApiService);
  readonly relationshipLabels = RELATIONSHIP_LABELS;
  readonly relationships = Object.keys(RELATIONSHIP_LABELS) as Relationship[];

  readonly parentError = signal<string | null>(null);
  readonly parentBusy = signal<string | null>(null);
  readonly parentFilter = signal('');
  readonly showInactiveParents = signal(false);

  parentForm: ParentInput = this.emptyParentForm();
  /** Optional first child when creating an account at the school desk. */
  parentFirstChild: ChildLink = { studentId: '', relationship: 'mere' };
  editingParentId: string | null = null;
  linkingParentId: string | null = null;
  linkForm: ChildLink = { studentId: '', relationship: 'mere' };

  readonly visibleParents = computed(() => {
    const query = normalize(this.parentFilter());
    return this.parentsApi.parents().filter(p =>
      (p.status !== 'inactive' || this.showInactiveParents()) &&
      (!query || normalize([
        p.full_name, p.email ?? '', p.phone ?? '',
        ...p.children.map(c => `${c.first_name} ${c.last_name}`)
      ].join(' ')).includes(query))
    );
  });

  relationshipLabel(code: string): string {
    return RELATIONSHIP_LABELS[code as Relationship] ?? code;
  }

  /** Students not yet linked to this parent, for the "link a child" picker. */
  linkableStudents(parent: ParentAccount): ApiStudent[] {
    const linked = new Set(parent.children.map(c => c.student_id));
    return this.api.students().filter(s => !linked.has(s.id));
  }

  async saveParent(): Promise<void> {
    const form = this.parentForm;
    if (!form.fullName.trim() || !form.email.trim()) {
      this.parentError.set('Le nom complet et l’email sont obligatoires.');
      return;
    }
    this.parentBusy.set('form');
    this.parentError.set(null);
    try {
      if (this.editingParentId) {
        const parent = await this.parentsApi.update(this.editingParentId, { ...form });
        this.flash(`${parent.full_name} a été mis(e) à jour.`);
      } else {
        const children = this.parentFirstChild.studentId ? [{ ...this.parentFirstChild }] : [];
        const { parent, temporaryPassword } = await this.parentsApi.create(form, children);
        this.revealedPassword.set({ name: parent.full_name, email: parent.email ?? '', password: temporaryPassword, isNew: true });
        this.copied.set(false);
      }
      this.cancelParentEdit();
    } catch (error) {
      this.parentError.set((error as Error).message);
    } finally {
      this.parentBusy.set(null);
    }
  }

  beginEditParent(parent: ParentAccount): void {
    this.editingParentId = parent.id;
    this.linkingParentId = null;
    this.parentError.set(null);
    this.parentForm = { fullName: parent.full_name, email: parent.email ?? '', phone: parent.phone ?? '' };
  }

  cancelParentEdit(): void {
    this.editingParentId = null;
    this.parentForm = this.emptyParentForm();
    this.parentFirstChild = { studentId: '', relationship: 'mere' };
    this.parentError.set(null);
  }

  async toggleParentActive(parent: ParentAccount): Promise<void> {
    const activate = !parent.active;
    if (!activate && !window.confirm(
      `Désactiver le compte de ${parent.full_name} ?\nIl/elle sera déconnecté(e) immédiatement et ne pourra plus se connecter.`)) {
      return;
    }
    await this.runParentAction(parent.id, async () => {
      await this.parentsApi.update(parent.id, { active: activate });
      this.flash(activate ? `${parent.full_name} est de nouveau actif.` : `Le compte de ${parent.full_name} est désactivé.`);
    });
  }

  async resetParentPassword(parent: ParentAccount): Promise<void> {
    if (!window.confirm(
      `Générer un nouveau mot de passe provisoire pour ${parent.full_name} ?\nSon mot de passe actuel cessera de fonctionner et ses sessions seront fermées.`)) {
      return;
    }
    await this.runParentAction(parent.id, async () => {
      const password = await this.parentsApi.resetPassword(parent.id);
      this.revealedPassword.set({ name: parent.full_name, email: parent.email ?? '', password, isNew: false });
      this.copied.set(false);
    });
  }

  openLinkChild(parent: ParentAccount): void {
    this.linkingParentId = this.linkingParentId === parent.id ? null : parent.id;
    this.linkForm = { studentId: '', relationship: 'mere' };
    this.parentError.set(null);
  }

  async linkChild(parent: ParentAccount): Promise<void> {
    if (!this.linkForm.studentId) {
      this.parentError.set('Choisissez l’élève à rattacher.');
      return;
    }
    await this.runParentAction(parent.id, async () => {
      const updated = await this.parentsApi.linkChild(parent.id, { ...this.linkForm });
      const child = updated.children.find(c => c.student_id === this.linkForm.studentId);
      this.linkingParentId = null;
      this.flash(`${child ? child.first_name + ' ' + child.last_name : 'L’élève'} est rattaché(e) à ${parent.full_name}.`);
    });
  }

  async unlinkChild(parent: ParentAccount, child: ParentChild): Promise<void> {
    if (!window.confirm(
      `Détacher ${child.first_name} ${child.last_name} de ${parent.full_name} ?\nLe parent ne verra plus aucune donnée de cet enfant.`)) {
      return;
    }
    await this.runParentAction(parent.id, async () => {
      await this.parentsApi.unlinkChild(parent.id, child.student_id);
      this.flash(`${child.first_name} ${child.last_name} n’est plus rattaché(e) à ${parent.full_name}.`);
    });
  }

  private async runParentAction(parentId: string, action: () => Promise<void>): Promise<void> {
    this.parentBusy.set(parentId);
    this.parentError.set(null);
    try {
      await action();
    } catch (error) {
      this.parentError.set((error as Error).message);
    } finally {
      this.parentBusy.set(null);
    }
  }

  private emptyParentForm(): ParentInput {
    return { fullName: '', email: '', phone: '' };
  }

  // ------------------------------------------------------------ staff (API)

  readonly staffApi = inject(StaffApiService);
  readonly auth = inject(AuthService);
  readonly roleLabels = STAFF_ROLE_LABELS;
  readonly staffRoles = Object.keys(STAFF_ROLE_LABELS) as StaffRole[];

  readonly staffError = signal<string | null>(null);
  readonly staffBusy = signal<string | null>(null);
  readonly showInactiveStaff = signal(false);
  /** One-time password just generated by the server, shown until the admin closes it. */
  readonly revealedPassword = signal<{ name: string; email: string; password: string; isNew: boolean } | null>(null);
  readonly copied = signal(false);

  staffForm: StaffInput = this.emptyStaffForm();
  editingStaffId: string | null = null;

  readonly visibleStaff = computed(() =>
    this.staffApi.staff().filter(s => s.active || this.showInactiveStaff()));

  isSelf(member: StaffMember): boolean {
    return member.id === this.auth.currentUser()?.id;
  }

  /** A super-admin can only be managed by another super-admin. */
  isLocked(member: StaffMember): boolean {
    return !!member.is_super_admin && !this.isSelf(member) && !this.auth.currentUser()?.is_super_admin;
  }

  async saveStaff(): Promise<void> {
    const form = this.staffForm;
    if (!form.fullName.trim() || !form.email.trim()) {
      this.staffError.set('Le nom complet et l’email sont obligatoires.');
      return;
    }
    this.staffBusy.set('form');
    this.staffError.set(null);
    try {
      if (this.editingStaffId) {
        const member = await this.staffApi.update(this.editingStaffId, { ...form });
        this.flash(`${member.full_name} a été mis(e) à jour.`);
      } else {
        const { user, temporaryPassword } = await this.staffApi.create(form);
        this.revealedPassword.set({ name: user.full_name, email: user.email ?? '', password: temporaryPassword, isNew: true });
        this.copied.set(false);
      }
      this.cancelStaffEdit();
      void this.api.load(); // the Classes tab lists active teachers
    } catch (error) {
      this.staffError.set((error as Error).message);
    } finally {
      this.staffBusy.set(null);
    }
  }

  beginEditStaff(member: StaffMember): void {
    this.editingStaffId = member.id;
    this.staffError.set(null);
    this.staffForm = { fullName: member.full_name, email: member.email ?? '', phone: member.phone ?? '', role: member.role };
  }

  cancelStaffEdit(): void {
    this.editingStaffId = null;
    this.staffForm = this.emptyStaffForm();
    this.staffError.set(null);
  }

  async toggleStaffActive(member: StaffMember): Promise<void> {
    const activate = !member.active;
    if (!activate && !window.confirm(
      `Désactiver le compte de ${member.full_name} ?\nLa personne sera déconnectée immédiatement et ne pourra plus se connecter.`)) {
      return;
    }
    this.staffBusy.set(member.id);
    this.staffError.set(null);
    try {
      await this.staffApi.update(member.id, { active: activate });
      this.flash(activate ? `${member.full_name} est de nouveau actif.` : `Le compte de ${member.full_name} est désactivé.`);
      void this.api.load();
    } catch (error) {
      this.staffError.set((error as Error).message);
    } finally {
      this.staffBusy.set(null);
    }
  }

  async resetStaffPassword(member: StaffMember): Promise<void> {
    if (!window.confirm(
      `Générer un nouveau mot de passe provisoire pour ${member.full_name} ?\nSon mot de passe actuel cessera de fonctionner et ses sessions seront fermées.`)) {
      return;
    }
    this.staffBusy.set(member.id);
    this.staffError.set(null);
    try {
      const password = await this.staffApi.resetPassword(member.id);
      this.revealedPassword.set({ name: member.full_name, email: member.email ?? '', password, isNew: false });
      this.copied.set(false);
    } catch (error) {
      this.staffError.set((error as Error).message);
    } finally {
      this.staffBusy.set(null);
    }
  }

  async copyRevealedPassword(): Promise<void> {
    const revealed = this.revealedPassword();
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.password);
      this.copied.set(true);
    } catch {
      this.copied.set(false); // Clipboard blocked: the password stays visible to copy by hand.
    }
  }

  private emptyStaffForm(): StaffInput {
    return { fullName: '', email: '', phone: '', role: 'teacher' };
  }

  addLevel() {
    const code = this.levelForm.code.trim();
    const nameFr = this.levelForm.name_fr.trim();
    const nameAr = this.levelForm.name_ar.trim();

    if (!code || !nameFr || !nameAr) {
      return;
    }

    this.schoolData.addLevel({
      code,
      name_fr: nameFr,
      name_ar: nameAr,
      position: this.levelForm.position
    });

    this.levelForm = {
      code: '',
      name_fr: '',
      name_ar: '',
      position: this.schoolData.levels().length + 1
    };
  }

  beginEditLevel(levelId: string) {
    const level = this.schoolData.levels().find(item => item.id === levelId);
    if (!level) {
      return;
    }

    this.levelEditForm = {
      id: level.id,
      code: level.code,
      name_fr: level.name_fr,
      name_ar: level.name_ar,
      position: level.position
    };
  }

  saveLevelUpdate() {
    const code = this.levelEditForm.code.trim();
    const nameFr = this.levelEditForm.name_fr.trim();
    const nameAr = this.levelEditForm.name_ar.trim();

    if (!this.levelEditForm.id || !code || !nameFr || !nameAr) {
      return;
    }

    this.schoolData.updateLevel(this.levelEditForm.id, {
      code,
      name_fr: nameFr,
      name_ar: nameAr,
      position: this.levelEditForm.position
    });

    this.cancelLevelEdit();
  }

  cancelLevelEdit() {
    this.levelEditForm = {
      id: '',
      code: '',
      name_fr: '',
      name_ar: '',
      position: 1
    };
  }

  deleteLevel(levelId: string) {
    const level = this.schoolData.levels().find(item => item.id === levelId);
    if (!level) {
      return;
    }

    const ok = window.confirm(`Supprimer le niveau ${level.name_fr} ?`);
    if (ok) {
      this.schoolData.deleteLevel(levelId);
    }
  }

  addSubject() {
    const nameFr = this.subjectForm.name_fr.trim();
    const nameAr = this.subjectForm.name_ar.trim();
    if (!nameFr || !nameAr) return;

    const duplicate = this.schoolData.subjects().some(item => item.name_fr.toLowerCase() === nameFr.toLowerCase());
    if (duplicate) {
      window.alert('Cette matière existe déjà.');
      return;
    }

    this.schoolData.subjects.update(list => [...list, {
      id: `sbj-${nameFr.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      domain_id: this.subjectForm.domain_id,
      name_fr: nameFr,
      name_ar: nameAr,
      is_foreign_language: this.subjectForm.is_foreign_language,
      position: this.subjectForm.position
    }]);
    this.schoolData.saveToStorage();
    this.subjectForm = { domain_id: 'dom-ar', name_fr: '', name_ar: '', is_foreign_language: false, position: 1 };
  }

  beginEditSubject(subjectId: string) {
    const subject = this.schoolData.subjects().find(item => item.id === subjectId);
    if (!subject) return;

    this.subjectEditForm = {
      id: subject.id,
      domain_id: subject.domain_id,
      name_fr: subject.name_fr,
      name_ar: subject.name_ar,
      is_foreign_language: subject.is_foreign_language,
      position: subject.position
    };
  }

  saveSubjectUpdate() {
    if (!this.subjectEditForm.id) return;

    const nameFr = this.subjectEditForm.name_fr.trim();
    const nameAr = this.subjectEditForm.name_ar.trim();
    if (!nameFr || !nameAr) return;

    const duplicate = this.schoolData.subjects().some(subject =>
      subject.id !== this.subjectEditForm.id && subject.name_fr.toLowerCase() === nameFr.toLowerCase()
    );
    if (duplicate) {
      window.alert('Une autre matière porte déjà ce nom.');
      return;
    }

    this.schoolData.subjects.update(list => list.map(subject => subject.id === this.subjectEditForm.id ? {
      ...subject,
      domain_id: this.subjectEditForm.domain_id,
      name_fr: nameFr,
      name_ar: nameAr,
      is_foreign_language: this.subjectEditForm.is_foreign_language,
      position: this.subjectEditForm.position
    } : subject));
    this.schoolData.saveToStorage();
    this.cancelSubjectEdit();
  }

  cancelSubjectEdit() {
    this.subjectEditForm = {
      id: '',
      domain_id: 'dom-ar',
      name_fr: '',
      name_ar: '',
      is_foreign_language: false,
      position: 1
    };
  }

  deleteSubject(subjectId: string) {
    const subject = this.schoolData.subjects().find(item => item.id === subjectId);
    if (!subject) return;

    if (window.confirm(`Supprimer la matière « ${subject.name_fr} » ?`)) {
      this.schoolData.subjects.update(list => list.filter(item => item.id !== subjectId));
      this.schoolData.classSubjects.update(list => list.filter(item => item.subject_id !== subjectId));
      this.schoolData.saveToStorage();
    }
  }

  getLevelName(levelId?: string): string {
    return this.schoolData.levels().find(level => level.id === levelId)?.name_fr || 'Niveau';
  }
}
