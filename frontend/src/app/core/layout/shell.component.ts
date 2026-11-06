import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Api } from '../api';
import { ROLE_LABEL, Session } from '../auth/session';
import { IconComponent } from '../../shared/icon/icon.component';
import { initials } from '../../shared/initials';
import { ToastService } from '../../shared/toast/toast.service';
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
      <footer><b>Campus Events</b><span>Nền tảng quản lý sự kiện dành cho sinh viên</span></footer>
    </div>
  `,
})
export class ShellComponent {
  protected readonly api = inject(Api);
  protected readonly session = inject(Session);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly user = this.api.user;
  protected readonly loggingOut = signal(false);
  protected readonly nav = computed(() => NAV_BY_ROLE[this.user()?.role ?? ''] ?? []);
  protected readonly caption = computed(() => SPACE_CAPTION[this.user()?.role ?? ''] ?? '');
  protected readonly roleLabel = computed(() => ROLE_LABEL[this.user()?.role ?? ''] ?? '');
  protected readonly initials = computed(() => initials(this.user()?.fullName ?? ''));

  /** Title of the deepest active route (route data.title). */
  protected readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
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
      await this.api.logout();
      this.toast.success('Bạn đã đăng xuất thành công.');
    } catch (error) {
      // Api.logout already cleared the local session; the message explains the pending server revoke.
      this.toast.error(error instanceof Error ? error.message : 'Không đăng xuất được.');
    } finally {
      this.loggingOut.set(false);
    }
  }

  private deepestTitle(): string {
    // Routes are nested (shell -> page); the page's own title sits on the deepest child.
    let snapshot = this.route.snapshot;
    while (snapshot?.firstChild) snapshot = snapshot.firstChild;
    return (snapshot?.data?.['title'] as string) ?? '';
  }
}
