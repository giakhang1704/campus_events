import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
    <app-page-header title="Hệ thống & mockup" subtitle="Angular → Spring Boot → PostgreSQL">
      <button class="primary" (click)="check()" [disabled]="busy()">{{ busy() ? 'Đang kiểm tra…' : 'Kiểm tra kết nối' }}</button>
    </app-page-header>
    <div class="notice" [class.success]="ok() === true" [class.warn]="ok() === false" role="status">
      <b>{{ status() }}</b><br />{{ detail() }}
    </div>
    <div class="notice warn">
      Bên dưới là mockup HTML (public/mockup) dùng dữ liệu trên trình duyệt, chỉ để tham khảo các màn chưa tích hợp.
      Đăng nhập trong khung mockup là mô phỏng, không liên quan tài khoản thật.
    </div>
    <iframe src="mockup/index.html" title="Mockup Campus Events"></iframe>
  `,
  styles: `iframe { width: 100%; height: 80vh; min-height: 600px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }`,
})
export class EnvironmentPage {
  private readonly api = inject(Api);
  protected readonly status = signal('Chưa kiểm tra');
  protected readonly detail = signal('Bấm Kiểm tra kết nối để xác nhận backend và schema database.');
  protected readonly busy = signal(false);
  protected readonly ok = signal<boolean | null>(null);

  protected async check(): Promise<void> {
    this.busy.set(true);
    try {
      const r = await this.api.request<{ status: string; tables: number }>('/health');
      if (r.status !== 'UP') throw new Error();
      this.ok.set(true);
      this.status.set('Kết nối thành công');
      this.detail.set(`Backend đã truy vấn PostgreSQL; schema campus có ${r.tables} bảng.`);
    } catch {
      this.ok.set(false);
      this.status.set('Chưa kết nối được');
      this.detail.set('Kiểm tra docker compose ps và logs backend/db theo README.');
    } finally {
      this.busy.set(false);
    }
  }
}
