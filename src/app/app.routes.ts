import { Routes } from '@angular/router';
import { authGuard, guestGuard, passwordChangeGuard, roleGuard } from './core/guards/auth.guards';
import { UserRole } from './core/models/school.model';

/** Wraps a group of child routes behind authentication + role checks. */
const protectedArea = (path: string, roles: UserRole[], children: Routes) => ({
  path,
  canActivate: [authGuard, passwordChangeGuard],
  canActivateChild: [roleGuard],
  data: { roles },
  children: children.map(child => ({ ...child, data: { roles, ...child.data } }))
});

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Public pages (signed-in users are redirected to their home page)
  {
    path: 'login',
    canMatch: [guestGuard],
    title: 'Connexion · Excellence School',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    canMatch: [guestGuard],
    title: 'Inscription parent · Excellence School',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },

  protectedArea('parent', ['parent'], [
    { path: 'dashboard', title: 'Tableau de bord', loadComponent: () => import('./features/parent/parent-dashboard/parent-dashboard.component').then(m => m.ParentDashboardComponent) },
    { path: 'grades', title: 'Notes', loadComponent: () => import('./features/parent/parent-grades/parent-grades.component').then(m => m.ParentGradesComponent) },
    { path: 'homework', title: 'Devoirs', loadComponent: () => import('./features/parent/parent-homework/parent-homework.component').then(m => m.ParentHomeworkComponent) },
    { path: 'attendance', title: 'Absences', loadComponent: () => import('./features/parent/parent-attendance/parent-attendance.component').then(m => m.ParentAttendanceComponent) },
    { path: 'timetable', title: 'Emploi du temps', loadComponent: () => import('./features/parent/parent-timetable/parent-timetable.component').then(m => m.ParentTimetableComponent) },
    { path: 'fees', title: 'Frais scolaires', loadComponent: () => import('./features/parent/parent-fees/parent-fees.component').then(m => m.ParentFeesComponent) },
    { path: 'messages', title: 'Messages', loadComponent: () => import('./features/messages/messages.component').then(m => m.MessagesComponent) },
    { path: 'calendar', title: 'Calendrier scolaire', loadComponent: () => import('./features/admin/calendar-admin/calendar-admin.component').then(m => m.CalendarAdminComponent) },
    { path: 'appointments', title: 'Rendez-vous', loadComponent: () => import('./features/parent/parent-appointments/parent-appointments.component').then(m => m.ParentAppointmentsComponent) },
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
  ]),
  {
    path: 'change-password',
    title: 'Changer le mot de passe · Excellence School',
    canActivate: [authGuard],
    loadComponent: () => import('./features/auth/change-password/change-password.component').then(m => m.ChangePasswordComponent)
  },

  {
    path: 'pwa-install',
    title: 'Installer l’application',
    canActivate: [authGuard, passwordChangeGuard],
    loadComponent: () => import('./features/parent/pwa-install/pwa-install.component').then(m => m.PwaInstallComponent)
  },

  protectedArea('teacher', ['teacher'], [
    { path: 'classes', title: 'Mes classes', loadComponent: () => import('./features/teacher/teacher-classes/teacher-classes.component').then(m => m.TeacherClassesComponent) },
    { path: 'attendance', title: 'Appel', loadComponent: () => import('./features/teacher/teacher-attendance/teacher-attendance.component').then(m => m.TeacherAttendanceComponent) },
    { path: 'grades', title: 'Saisie des notes', loadComponent: () => import('./features/teacher/teacher-grades/teacher-grades.component').then(m => m.TeacherGradesComponent) },
    { path: 'homework', title: 'Devoirs', loadComponent: () => import('./features/teacher/teacher-homework/teacher-homework.component').then(m => m.TeacherHomeworkComponent) },
    { path: 'messages', title: 'Messages', loadComponent: () => import('./features/messages/messages.component').then(m => m.MessagesComponent) },
    { path: 'calendar', title: 'Calendrier scolaire', loadComponent: () => import('./features/admin/calendar-admin/calendar-admin.component').then(m => m.CalendarAdminComponent) },
    { path: 'appointments', title: 'Rendez-vous', loadComponent: () => import('./features/teacher/teacher-appointments/teacher-appointments.component').then(m => m.TeacherAppointmentsComponent) },
    { path: '', redirectTo: 'classes', pathMatch: 'full' }
  ]),

  protectedArea('econome', ['econome', 'admin'], [
    { path: 'payments', title: 'Saisie des paiements', loadComponent: () => import('./features/econome/payments-entry/payments-entry.component').then(m => m.PaymentsEntryComponent) },
    { path: 'fees', title: 'Frais', loadComponent: () => import('./features/econome/payments-overview/payments-overview.component').then(m => m.PaymentsOverviewComponent) },
    { path: 'calendar', title: 'Calendrier scolaire', loadComponent: () => import('./features/admin/calendar-admin/calendar-admin.component').then(m => m.CalendarAdminComponent) },
    { path: 'finance', title: 'Finances', loadComponent: () => import('./features/econome/payments-overview/payments-overview.component').then(m => m.PaymentsOverviewComponent) },
    { path: '', redirectTo: 'finance', pathMatch: 'full' }
  ]),

  protectedArea('moderator', ['moderator', 'admin'], [
    { path: 'dashboard', title: 'Modération', data: { roles: ['moderator'] }, loadComponent: () => import('./features/moderator/moderator-dashboard/moderator-dashboard.component').then(m => m.ModeratorDashboardComponent) },
    { path: 'avis', title: 'Avis', loadComponent: () => import('./features/moderator/moderator-avis/moderator-avis.component').then(m => m.ModeratorAvisComponent) },
    { path: 'services', title: 'Services annexes', loadComponent: () => import('./features/moderator/services-annexes/services-annexes.component').then(m => m.ServicesAnnexesComponent) },
    { path: 'calendar', title: 'Calendrier scolaire', loadComponent: () => import('./features/admin/calendar-admin/calendar-admin.component').then(m => m.CalendarAdminComponent) },
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
  ]),

  protectedArea('admin', ['admin'], [
    { path: 'dashboard', title: 'Administration', loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) },
    { path: 'link-requests', title: 'Demandes de liaison', loadComponent: () => import('./features/admin/link-requests/link-requests.component').then(m => m.LinkRequestsComponent) },
    { path: 'structure', title: 'Structure scolaire', loadComponent: () => import('./features/admin/school-structure/school-structure.component').then(m => m.SchoolStructureComponent) },
    { path: 'services', title: 'Services annexes', loadComponent: () => import('./features/moderator/services-annexes/services-annexes.component').then(m => m.ServicesAnnexesComponent) },
    { path: 'bulletins', title: 'Bulletins', loadComponent: () => import('./features/admin/bulletins-admin/bulletins-admin.component').then(m => m.BulletinsAdminComponent) },
    // The moderator also manages news.
    { path: 'news', title: 'Actualités', data: { roles: ['admin', 'moderator'] }, loadComponent: () => import('./features/admin/news-admin/news-admin.component').then(m => m.NewsAdminComponent) },
    { path: 'calendar', title: 'Calendrier', loadComponent: () => import('./features/admin/calendar-admin/calendar-admin.component').then(m => m.CalendarAdminComponent) },
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
  ]),

  { path: '**', redirectTo: 'login' }
];
