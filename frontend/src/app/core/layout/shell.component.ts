import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Api } from '../api';
import { ROLE_LABEL, Session } from '../auth/session';
import { IconComponent } from '../../shared/icon/icon.component';
import { NAV_BY_ROLE, SPACE_CAPTION } from './navigation';

/** Logged-in layout: sidebar + topbar + page (mockup `shell()`). */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sidebar">
      <a class="brand" [routerLink]="session.homeUrl()"><span class="brand-mark">ce</span><span>campus<em>events</em></span></a>
      <div class="school">Không gian sự kiện sinh viên</div>
      <div class="nav-caption">{{ caption() }}</div>
      <nav class="nav" aria-label="Điều hướng chính">
        @for (item of nav(); track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active"><app-icon [name]="item.icon" /><span>{{ item.label }}</span></a>
        }
        <a routerLink="/system" routerLinkActive="active"><app-icon name="server" /><span>Hệ thống &amp; mockup</span></a>
      </nav>
      <div class="sidebar-bottom">
        <div class="profile">
          <span class="avatar">{{ initials() }}</span>
          <div><b>{{ user()?.fullName }}</b><small>{{ user()?.email }}</small></div>
        </div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="breadcrumb">{{ roleLabel() }}<span>/</span>{{ pageTitle() }}</div>
        <div class="top-actions">
          <div class="user-chip">
            <span class="avatar">{{ initials() }}</span>
            <div><b>{{ user()?.fullName }}</b><small>{{ roleLabel() }}</small></div>
          </div>
          <button class="ghost logout" title="Đăng xuất" aria-label="Đăng xuất" [disabled]="loggingOut()" (click)="logout()">
            <app-icon name="logout" />
          </button>
        </div>
      </header>
      <main><router-outlet /></main>
      <footer><b>Campus Events</b><span>Angular · Spring Boot · PostgreSQL · {{ year }}</span></footer>
    </div>
  `,
})
export class ShellComponent {
  protected readonly api = inject(Api);
  protected readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly user = this.api.user;
  protected readonly year = new Date().getFullYear();
  protected readonly loggingOut = signal(false);
  protected readonly nav = computed(() => NAV_BY_ROLE[this.user()?.role ?? ''] ?? []);
  protected readonly caption = computed(() => SPACE_CAPTION[this.user()?.role ?? ''] ?? '');
  protected readonly roleLabel = computed(() => ROLE_LABEL[this.user()?.role ?? ''] ?? '');
  protected readonly initials = computed(() =>
    (this.user()?.fullName ?? '')
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join(''),
  );

  /** Title of the deepest active route (route data.title). */
  protected readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.deepestTitle()),
    ),
    { initialValue: this.deepestTitle() },
  );

  constructor() {
    // Session expired (any API call got 401) or logged out in another tab → back to login.
    effect(() => {
      if (!this.user()) void this.router.navigateByUrl('/login');
    });
  }

  protected async logout(): Promise<void> {
    this.loggingOut.set(true);
    try {
      this.session.loginNotice.set('Bạn đã đăng xuất.');
      await this.api.logout();
    } catch (e) {
      // Api.logout already cleared the local session; the message explains the pending server revoke.
      this.session.loginNotice.set(e instanceof Error ? e.message : 'Không đăng xuất được.');
    } finally {
      this.loggingOut.set(false);
    }
  }

  private deepestTitle(): string {
    let s = this.route.snapshot;
    while (s?.firstChild) s = s.firstChild;
    return (s?.data?.['title'] as string) ?? '';
  }
}
