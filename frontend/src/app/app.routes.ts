import { Routes } from '@angular/router';
import { authGuard, guestGuard, homeRedirectGuard, mustChangePasswordGuard, roleGuard } from './core/auth/session';
import { ShellComponent } from './core/layout/shell.component';

const comingSoon = () => import('./shared/coming-soon/coming-soon.page').then((module) => module.ComingSoonPage);

/**
 * Screens marked comingSoon wait for backend APIs (later increments); data.mockupFn = source function in public/mockup/app.js.
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
      { path: 'my-events', canActivate: [roleGuard('STUDENT')], data: { title: 'Sự kiện của tôi', mockupFn: 'explore(true)' }, loadComponent: comingSoon },
      { path: 'scan', canActivate: [roleGuard('STUDENT')], data: { title: 'Điểm danh QR', mockupFn: 'scan' }, loadComponent: comingSoon },

      // ── ORGANIZER ──
      {
        path: 'manage',
        canActivate: [roleGuard('ORGANIZER')],
        data: { title: 'Sự kiện quản lý' },
        title: 'Sự kiện quản lý · BKevent',
        loadComponent: () => import('./features/events/organizer-events.component').then((module) => module.OrganizerEventsComponent),
      },
      { path: 'participants', canActivate: [roleGuard('ORGANIZER')], data: { title: 'Người tham gia', mockupFn: 'participants' }, loadComponent: comingSoon },
      { path: 'attendance', canActivate: [roleGuard('ORGANIZER')], data: { title: 'Điểm danh', mockupFn: 'attendance' }, loadComponent: comingSoon },
      { path: 'reports', canActivate: [roleGuard('ORGANIZER')], data: { title: 'Báo cáo', mockupFn: 'report' }, loadComponent: comingSoon },

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
