import { Routes } from '@angular/router';
import { authGuard, guestGuard, homeRedirectGuard, mustChangePasswordGuard, roleGuard } from './core/auth/session';
import { ShellComponent } from './core/layout/shell.component';

/**
 * Placeholder pages re-export ComingSoonPage until built; data.mockupFn = source function in public/mockup/app.js.
 * Sidebar menu lives in core/layout/navigation.ts – keep both in sync.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Đăng nhập · BKevent',
    loadComponent: () => import('./features/auth/login.page').then((module) => module.LoginPage),
  },
  {
    path: 'change-password',
    canActivate: [mustChangePasswordGuard],
    title: 'Đổi mật khẩu · BKevent',
    loadComponent: () => import('./features/auth/change-password.page').then((module) => module.ChangePasswordPage),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },

      // ── STUDENT ──
      {
        path: 'events',
        canActivate: [roleGuard('STUDENT', 'ORGANIZER')],
        data: { title: 'Khám phá sự kiện' },
        title: 'Khám phá sự kiện · BKevent',
        loadComponent: () => import('./features/events/student-events.page').then((module) => module.StudentEventsPage),
      },
      {
        path: 'events/:id',
        canActivate: [roleGuard('STUDENT', 'ORGANIZER')],
        data: { title: 'Chi tiết sự kiện' },
        title: 'Chi tiết sự kiện · BKevent',
        loadComponent: () => import('./features/events/student-event-detail.page').then((module) => module.StudentEventDetailPage),
      },
      {
        path: 'my-events',
        canActivate: [roleGuard('STUDENT')],
        data: { title: 'Sự kiện của tôi' },
        title: 'Sự kiện của tôi · BKevent',
        loadComponent: () => import('./features/registrations/my-registrations.page').then((module) => module.MyRegistrationsPage),
      },
      {
        path: 'scan',
        canActivate: [roleGuard('STUDENT')],
        data: { title: 'Điểm danh QR', mockupFn: 'scan' },
        title: 'Điểm danh QR · BKevent',
        loadComponent: () => import('./features/scan/scan.page').then((module) => module.ScanPage),
      },

      // ── ORGANIZER ──
      {
        path: 'manage',
        canActivate: [roleGuard('ORGANIZER')],
        data: { title: 'Sự kiện quản lý' },
        title: 'Sự kiện quản lý · BKevent',
        loadComponent: () => import('./features/events/organizer-events.component').then((module) => module.OrganizerEventsComponent),
      },
      {
        path: 'participants',
        canActivate: [roleGuard('ORGANIZER')],
        data: { title: 'Người tham gia' },
        title: 'Người tham gia · BKevent',
        loadComponent: () => import('./features/registrations/participants.page').then((module) => module.ParticipantsPage),
      },
      {
        path: 'attendance',
        canActivate: [roleGuard('ORGANIZER')],
        data: { title: 'Điểm danh' },
        title: 'Điểm danh · BKevent',
        loadComponent: () => import('./features/attendance/attendance.page').then((module) => module.AttendancePage),
      },
      {
        path: 'reports',
        canActivate: [roleGuard('ORGANIZER')],
        data: { title: 'Báo cáo', mockupFn: 'report' },
        title: 'Báo cáo · BKevent',
        loadComponent: () => import('./features/reports/reports.page').then((module) => module.ReportsPage),
      },

      // ── ADMIN ──
      {
        path: 'admin/accounts',
        canActivate: [roleGuard('ADMIN')],
        data: { title: 'Quản lý tài khoản' },
        title: 'Quản lý tài khoản · BKevent',
        loadComponent: () => import('./features/admin/accounts.component').then((module) => module.AccountsComponent),
      },

      {
        path: 'system',
        canActivate: [roleGuard('ADMIN')],
        data: { title: 'Trạng thái hệ thống' },
        title: 'Hệ thống · BKevent',
        loadComponent: () => import('./features/system/environment.page').then((module) => module.EnvironmentPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
