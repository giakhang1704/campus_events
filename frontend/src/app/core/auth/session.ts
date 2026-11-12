import { inject, Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ToastService } from '../../shared/toast/toast.service';
import { Api } from '../api';

/*
 * HOW AUTHENTICATION WORKS IN THE FRONTEND
 *
 * 1. Login: Api.login() sends email + password. The backend answers with the user and sets an
 *    HttpOnly session cookie. JavaScript cannot read that cookie (protection against XSS); the browser
 *    sends it automatically on every later API call. The user object is kept in the signal Api.user.
 *
 * 2. Page reload: Api.user is empty again, but the cookie is still there. Before the first guarded page
 *    renders, Session.ensureRestored() calls GET /api/auth/me once to get the user back.
 *
 * 3. Route guards (below) run before Angular shows a page. They read Api.user and either allow the page
 *    (return true) or redirect (return a UrlTree):
 *      authGuard               must be logged in and have changed the temporary password
 *      mustChangePasswordGuard only for accounts that still have a temporary password
 *      roleGuard('ADMIN', …)   only these roles
 *      guestGuard              /login is for logged-out users only
 *      homeRedirectGuard       "/" goes to the home page of the user's role
 *
 * 4. Guards only decide what the screen shows. Real security is on the server: every API call checks
 *    the session cookie and the role, so editing the frontend cannot unlock data.
 */

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

/** Restores the session after a reload and knows where each user should land. */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  /** Shared by every guard, so GET /api/auth/me is sent once even if several guards wait for it. */
  private restoring: Promise<void> | null = null;

  /** Step 2 above. A failure (server down) is shown as a toast; the user then simply sees /login. */
  ensureRestored(): Promise<void> {
    this.restoring ??= this.api.refresh().catch((error) => {
      this.toast.error(error instanceof Error ? error.message : 'Dịch vụ tạm thời gián đoạn. Vui lòng thử lại.');
    });
    return this.restoring;
  }

  /** Where the current user belongs: login, the forced password change, or their role's home page. */
  homeUrl(): string {
    const user = this.api.user();
    if (!user) return '/login';
    if (user.mustChangePassword) return '/change-password';
    return HOME_BY_ROLE[user.role] ?? '/system';
  }
}

// The guards below are async because they wait for ensureRestored(). Angular only allows inject()
// before the first `await`, so every guard reads its services first and awaits afterwards.

/** Logged in, and the temporary password has already been changed. */
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

/** Only for accounts that must replace their temporary password; everyone else goes home. */
export const mustChangePasswordGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const api = inject(Api);
  const router = inject(Router);
  await session.ensureRestored();
  return api.user()?.mustChangePassword ? true : router.parseUrl(session.homeUrl());
};

/**
 * Only the given roles may open the page; others are sent to their own home page.
 * Synchronous: it always runs after authGuard (on the parent route), so the session is already restored.
 */
export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  () => {
    const user = inject(Api).user();
    const allowed = !!user && roles.includes(user.role as Role);
    return allowed ? true : inject(Router).parseUrl(inject(Session).homeUrl());
  };

/** Keeps logged-in users away from /login. */
export const guestGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const api = inject(Api);
  const router = inject(Router);
  await session.ensureRestored();
  return api.user() ? router.parseUrl(session.homeUrl()) : true;
};

/** "/" → the home page of the user's role (or /login). */
export const homeRedirectGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const router = inject(Router);
  await session.ensureRestored();
  return router.parseUrl(session.homeUrl());
};
