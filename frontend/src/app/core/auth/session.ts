import { inject, Injectable } from '@angular/core';
import { ToastService } from '../../shared/toast/toast.service';
import { CanActivateFn, Router } from '@angular/router';
import { Api } from '../api';

export type Role = 'STUDENT' | 'ORGANIZER' | 'ADMIN';

export const ROLE_LABEL: Record<string, string> = {
  STUDENT: 'Sinh viên',
  ORGANIZER: 'Người tổ chức',
  ADMIN: 'Quản trị viên',
};

/** First page of each role after login. */
export const HOME_BY_ROLE: Record<string, string> = {
  STUDENT: '/events',
  ORGANIZER: '/manage',
  ADMIN: '/admin/accounts',
};

/**
 * Restores the cookie session once (GET /api/auth/me via Api.refresh) before the first guarded route renders.
 * Auth state itself stays in Api.user so the I1 screens keep working unchanged.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly api = inject(Api);
  private restoring: Promise<void> | null = null;
  private readonly toast = inject(ToastService);

  ensureRestored(): Promise<void> {
    this.restoring ??= this.api.refresh().catch((e) => {
      this.toast.error(e instanceof Error ? e.message : 'Dịch vụ tạm thời gián đoạn. Vui lòng thử lại.');
    });
    return this.restoring;
  }

  homeUrl(): string {
    const user = this.api.user();
    if (!user) return '/login';
    if (user.mustChangePassword) return '/change-password';
    return HOME_BY_ROLE[user.role] ?? '/system';
  }
}

// Guards are async (they wait for the session restore), so every inject() must run before the first await.

/** Logged in and temporary password already changed. */
export const authGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const api = inject(Api);
  const router = inject(Router);
  await session.ensureRestored();
  const user = api.user();
  if (!user) return router.parseUrl('/login');
  if (user.mustChangePassword) return router.parseUrl('/change-password');
  return true;
};

/** Only for accounts that must replace their temporary password. */
export const mustChangePasswordGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const api = inject(Api);
  const router = inject(Router);
  await session.ensureRestored();
  return api.user()?.mustChangePassword ? true : router.parseUrl(session.homeUrl());
};

/** UI-only role check; the backend enforces permissions on every API call. */
export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  () => {
    const user = inject(Api).user();
    return user && roles.includes(user.role as Role) ? true : inject(Router).parseUrl(inject(Session).homeUrl());
  };

/** Keeps logged-in users away from /login. */
export const guestGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const api = inject(Api);
  const router = inject(Router);
  await session.ensureRestored();
  return api.user() ? router.parseUrl(session.homeUrl()) : true;
};

/** "/" → role home. */
export const homeRedirectGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const router = inject(Router);
  await session.ensureRestored();
  return router.parseUrl(session.homeUrl());
};
