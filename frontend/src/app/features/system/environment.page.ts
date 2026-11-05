import { ChangeDetectionStrategy, Component, inject, isDevMode, signal } from '@angular/core';
import { Api } from '../../core/api';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

/**
 * Real GET /api/health check + embedded HTML mockup (public/mockup, localStorage only)
 * as a reference while the remaining screens are built. Remove the iframe once every screen exists in Angular.
 */
@Component({
  selector: 'app-environment',
  imports: [PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Trạng thái hệ thống" subtitle="Kiểm tra máy chủ và cơ sở dữ liệu có đang hoạt động.">
      <button class="primary" (click)="check()" [disabled]="busy()">{{ busy() ? 'Đang kiểm tra…' : 'Kiểm tra kết nối' }}</button>
    </app-page-header>
    <div class="notice" [class.success]="ok() === true" [class.warn]="ok() === false" role="status">
      <b>{{ status() }}</b><br />{{ detail() }}
    </div>
    @if (devMode) {
      <!-- DEV ONLY: HTML mockup of screens not built yet; never shown in production builds. -->
      <h2 class="gap-top">Bản mẫu giao diện (chỉ ở môi trường phát triển)</h2>
      <p class="muted gap-bottom">Dữ liệu trong khung mẫu nằm trên trình duyệt, không liên quan tài khoản thật.</p>
      <iframe src="mockup/index.html" title="Bản mẫu giao diện Campus Events"></iframe>
    }
  `,
  styles: `iframe { width: 100%; height: 80vh; min-height: 600px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }`,
})
export class EnvironmentPage {
  private readonly api = inject(Api);
  protected readonly devMode = isDevMode();
  protected readonly status = signal('Chưa kiểm tra');
  protected readonly detail = signal('Bấm Kiểm tra kết nối để xem máy chủ và cơ sở dữ liệu có phản hồi không.');
  protected readonly busy = signal(false);
  protected readonly ok = signal<boolean | null>(null);

  protected async check(): Promise<void> {
    this.busy.set(true);
    try {
      const r = await this.api.request<{ status: string; tables: number }>('/health');
      if (r.status !== 'UP') throw new Error();
      this.ok.set(true);
      this.status.set('Kết nối thành công');
      this.detail.set(`Máy chủ và cơ sở dữ liệu đang hoạt động (${r.tables} bảng dữ liệu).`);
    } catch {
      this.ok.set(false);
      this.status.set('Chưa kết nối được');
      this.detail.set('Máy chủ chưa phản hồi. Kiểm tra dịch vụ backend và cơ sở dữ liệu theo hướng dẫn trong README.');
    } finally {
      this.busy.set(false);
    }
  }
}
