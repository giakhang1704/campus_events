import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { IconComponent } from '../icon/icon.component';
import { PageHeaderComponent } from '../page-header/page-header.component';

/**
 * Placeholder for screens not ported yet. Route data: { title, mockupFn }.
 * mockupFn = the function in public/mockup/app.js to port from.
 */
@Component({
  selector: 'app-coming-soon',
  imports: [PageHeaderComponent, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="data().title" subtitle="Chức năng này sẽ có ở increment sau, khi backend có API tương ứng." />
    <div class="empty">
      <app-icon name="edit" />
      <h3>Đang xây dựng</h3>
      <p>
        Chuyển từ hàm <code>{{ data().mockupFn }}()</code> trong
        <code>public/mockup/app.js</code>. Xem bản mẫu tại trang
        <a routerLink="/system">Môi trường &amp; mockup</a>.
      </p>
    </div>
  `,
})
export class ComingSoonPage {
  protected readonly data = toSignal(
    inject(ActivatedRoute).data.pipe(map((d) => ({ title: d['title'] as string, mockupFn: d['mockupFn'] as string }))),
    { requireSync: true },
  );
}
