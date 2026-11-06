import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../core/api';
import { Session } from '../../core/auth/session';
import { AuthComponent } from './auth.component';

/** /login: hosts the I1 login/register form and redirects to the role home once Api.user is set. */
@Component({
  selector: 'app-login-page',
  imports: [AuthComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-auth />`,
})
export class LoginPage {
  constructor() {
    const api = inject(Api);
    const session = inject(Session);
    const router = inject(Router);
    effect(() => {
      if (api.user()) void router.navigateByUrl(session.homeUrl());
    });
  }
}
