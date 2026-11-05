import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Session } from '../../core/auth/session';
import { IconComponent } from '../icon/icon.component';
import { PageHeaderComponent } from '../page-header/page-header.component';

/**
 * Placeholder for screens not built yet. Route data: { title, mockupFn }.
 * mockupFn (developer note only, never rendered) = the function in public/mockup/app.js to port from.
 */
@Component({
  selector: 'app-coming-soon',
  imports: [PageHeaderComponent, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="data().title" />
    <div class="empty">
      <app-icon name="calendar" />
      <h3>Tính năng sắp ra mắt</h3>
      <p>Chúng tôi đang hoàn thiện mục này. Trong lúc chờ, bạn có thể xem các sự kiện đang mở.</p>
      <a class="button" [routerLink]="session.homeUrl()">Về trang chính</a>
    </div>
  `,
})
export class ComingSoonPage {
  protected readonly session = inject(Session);
  protected readonly data = toSignal(
    inject(ActivatedRoute).data.pipe(map((d) => ({ title: d['title'] as string, mockupFn: d['mockupFn'] as string }))),
    { requireSync: true },
  );
}
