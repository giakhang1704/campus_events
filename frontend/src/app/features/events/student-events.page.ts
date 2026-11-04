import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { Api, Catalog } from '../../core/api';
import { CatalogService } from '../../core/catalog.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { EventApi } from './event-api.service';
import { CampusEvent } from './event.models';
import { PublicEventCardComponent } from './public-event-card.component';

/** /events: published events from GET /api/events (mockup `explore()`). */
@Component({
  selector: 'app-student-events',
  imports: [PageHeaderComponent, IconComponent, PublicEventCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Khám phá sự kiện" subtitle="Tìm những hoạt động bạn muốn tham gia tại trường." />

    <section class="hero">
      <div>
        <div class="eyebrow">KHÁM PHÁ · HỌC HỎI · KẾT NỐI</div>
        <h2>Bước ra khỏi lớp học.<br />Thêm một trải nghiệm mới.</h2>
        <p>Seminar, workshop và những cuộc gặp gỡ dành cho cộng đồng sinh viên{{ firstName() ? ', ' + firstName() : '' }}.</p>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="ticket">
          <small>CAMPUS PASS</small>
          <strong>Sự kiện<br />mới</strong>
          <div class="ticket-line"><span>Đăng ký</span><span>Điểm danh</span></div>
        </div>
        <span class="star">✦</span>
      </div>
    </section>

    <div class="section-head">
      <div>
        <h2>Sự kiện tại trường</h2>
        <p>{{ loading() ? 'Đang tải…' : summary() }}</p>
      </div>
    </div>

    <div class="toolbar">
      <label class="search">
        <app-icon name="search" />
        <input aria-label="Tìm sự kiện" placeholder="Tìm theo tên, mô tả hoặc địa điểm…" maxlength="100"
          [value]="query()" (input)="onSearch($any($event.target).value)" />
      </label>
      <!-- DEFERRED (scope 2026-11-03): category chips Tất cả / Học thuật / Nghề nghiệp / Văn hóa / Thể thao. -->
    </div>

    @if (error()) {
      <div class="notice warn" role="alert">{{ error() }} <button class="small" (click)="load()">Thử lại</button></div>
    }

    <div class="grid" [attr.aria-busy]="loading()">
      @for (e of items(); track e.id) {
        <app-public-event-card [event]="e" [unitName]="unitName(e.organizationUnitId)" />
      } @empty {
        @if (!loading() && !error()) {
          <div class="empty">
            <app-icon name="calendar" />
            <h3>{{ query() ? 'Không có sự kiện phù hợp' : 'Chưa có sự kiện nào được công bố' }}</h3>
            <p>{{ query() ? 'Thử từ khóa khác nhé.' : 'Quay lại sau để xem các hoạt động mới.' }}</p>
          </div>
        }
      }
    </div>

    @if (page() > 0 || hasNext()) {
      <div class="pager">
        <button class="small" [disabled]="page() === 0 || loading()" (click)="go(-1)"><app-icon name="back" /> Trang trước</button>
        <span>Trang {{ page() + 1 }}</span>
        <button class="small" [disabled]="!hasNext() || loading()" (click)="go(1)">Trang sau <app-icon name="arrow" /></button>
      </div>
    }
  `,
})
export class StudentEventsPage implements OnDestroy {
  private readonly events = inject(EventApi);
  private readonly api = inject(Api);
  private readonly catalogs = inject(CatalogService);

  protected readonly items = signal<CampusEvent[]>([]);
  protected readonly units = signal<Catalog[]>([]);
  protected readonly query = signal('');
  protected readonly page = signal(0);
  protected readonly hasNext = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  private searchTimer?: ReturnType<typeof setTimeout>;
  private requestId = 0;

  constructor() {
    void this.load();
    this.catalogs.getUnits().then((u) => this.units.set(u)).catch(() => {});
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  protected firstName(): string {
    return this.api.user()?.fullName.trim().split(/\s+/).pop() ?? '';
  }

  protected summary(): string {
    const n = this.items().length;
    if (!n) return 'Không có kết quả';
    return this.hasNext() || this.page() > 0 ? `${n} sự kiện trên trang này` : `${n} sự kiện`;
  }

  protected unitName(id: number): string {
    return this.units().find((u) => u.id === id)?.name ?? '';
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(0);
      void this.load();
    }, 350);
  }

  protected go(delta: number): void {
    this.page.update((p) => Math.max(0, p + delta));
    void this.load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected async load(): Promise<void> {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.events.listPublished(this.query().trim(), this.page());
      if (id !== this.requestId) return; // a newer search already started
      this.items.set(result.items);
      this.hasNext.set(result.hasNext);
    } catch (e) {
      if (id !== this.requestId) return;
      this.items.set([]);
      this.hasNext.set(false);
      this.error.set(e instanceof Error ? e.message : 'Không tải được danh sách sự kiện.');
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }
}
