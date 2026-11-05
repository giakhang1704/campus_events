import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, ApiError, Catalog } from '../../core/api';
import { CatalogService } from '../../core/catalog.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { EventApi } from './event-api.service';
import { CampusEvent } from './event.models';
import { dateTile, formatDateTime, formatLongDate, formatTime, isEligible, registrationWindow, WINDOW_BADGE } from './event-view';

/** /events/:id: published event detail from GET /api/events/{id} (mockup `detail()`). */
@Component({
  selector: 'app-student-event-detail',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="text-button back" routerLink="/events"><app-icon name="back" /> Quay lại danh sách</a>

    @if (loading()) {
      <p class="muted" role="status">Đang tải sự kiện…</p>
    } @else if (error(); as err) {
      <div class="empty">
        <app-icon name="info" />
        <h3>{{ err.title }}</h3>
        <p>{{ err.hint }}</p>
        <div class="actions center">
          @if (err.retry) {
            <button type="button" (click)="reload()">Thử lại</button>
          }
          <a class="button primary" routerLink="/events">Về danh sách sự kiện</a>
        </div>
      </div>
    } @else if (event(); as e) {
      <div class="split">
        <section class="panel detail-copy">
          <div class="poster detail-poster">
            <span class="date-tile">
              <strong>{{ tile().day }}</strong>
              <span><b>{{ tile().month }}</b><small>{{ tile().weekday }}</small></span>
            </span>
            <span class="poster-tag"><app-icon name="clock" /> {{ time(e.startsAt) }} – {{ time(e.endsAt) }}</span>
          </div>
          <span [class]="badge().css">{{ badge().label }}</span>
          <h1 class="gap-top">{{ e.title }}</h1>
          <h3>Giới thiệu</h3>
          <p>{{ e.description }}</p>
        </section>

        <aside class="panel sticky">
          <h3>Thông tin sự kiện</h3>
          <div class="info-row"><span>Ngày</span><b>{{ longDate(e.startsAt) }}</b></div>
          <div class="info-row"><span>Thời gian</span><b>{{ time(e.startsAt) }} – {{ time(e.endsAt) }}</b></div>
          <div class="info-row"><span>Địa điểm</span><b>{{ e.location }}</b></div>
          <div class="info-row"><span>Đơn vị tổ chức</span><b>{{ unitName() || '—' }}</b></div>
          <div class="info-row"><span>Sức chứa</span><b>{{ capacity() }} người</b></div>
          <div class="info-row"><span>Nhận đăng ký</span><b>{{ stamp(e.registrationOpensAt) }}<br />đến {{ stamp(e.registrationClosesAt) }}</b></div>
          <div class="info-row"><span>Đối tượng</span><b>{{ audience() }}</b></div>
          <div class="info-row"><span>Điểm danh</span><b>1 lần điểm danh đầu vào</b></div>

          @if (!eligible()) {
            <div class="notice warn">Bạn không thuộc khoa/năm học được tham gia sự kiện này.</div>
          }
          <!-- TODO(API): registration endpoints are not in increment I1; enable once BE ships them. -->
          <button class="primary block gap-top" disabled title="Chức năng đăng ký sẽ có ở increment sau">
            Đăng ký tham gia <app-icon name="arrow" />
          </button>
          <p class="muted small-text gap-top">Chức năng đăng ký trực tuyến đang được phát triển và sẽ mở ở phiên bản sau.</p>
        </aside>
      </div>
    }
  `,
})
export class StudentEventDetailPage {
  /** Bound from the :id route param (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly events = inject(EventApi);
  private readonly api = inject(Api);
  private readonly catalogs = inject(CatalogService);

  protected readonly event = signal<CampusEvent | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<{ title: string; hint: string; retry: boolean } | null>(null);
  private readonly departments = signal<Catalog[]>([]);
  private readonly units = signal<Catalog[]>([]);

  protected readonly tile = computed(() => dateTile(this.event()?.startsAt ?? new Date().toISOString()));
  protected readonly capacity = computed(() => new Intl.NumberFormat('vi-VN').format(this.event()?.capacity ?? 0));
  protected readonly badge = computed(() => {
    const b = WINDOW_BADGE[this.event() ? registrationWindow(this.event()!) : 'UPCOMING'];
    return { label: b.label, css: ('badge ' + b.css).trim() };
  });
  protected readonly eligible = computed(() => !!this.event() && isEligible(this.event()!, this.api.user()));
  protected readonly unitName = computed(() => this.units().find((u) => u.id === this.event()?.organizationUnitId)?.name ?? '');
  protected readonly audience = computed(() => {
    const e = this.event();
    if (!e) return '';
    const dept = e.departmentIds.length
      ? e.departmentIds.map((id) => this.departments().find((d) => d.id === id)?.name ?? `Khoa #${id}`).join(', ')
      : 'Mọi khoa';
    const years = e.studyYears.length ? 'năm ' + [...e.studyYears].sort((a, b) => a - b).join(', ') : 'mọi năm học';
    return `${dept} · ${years}`;
  });

  protected readonly longDate = formatLongDate;
  protected readonly time = formatTime;
  /** "12/11/2026 · 08:00", the app-wide timestamp format. */
  protected readonly stamp = formatDateTime;

  constructor() {
    this.catalogs.getDepartments().then((d) => this.departments.set(d)).catch(() => {});
    this.catalogs.getUnits().then((u) => this.units.set(u)).catch(() => {});
    effect(() => {
      void this.load(Number(this.id()));
    });
  }

  protected reload(): void {
    void this.load(Number(this.id()));
  }

  private async load(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (!Number.isInteger(id) || id <= 0) throw new ApiError(404, 'NOT_FOUND', '');
      this.event.set(await this.events.getPublished(id));
    } catch (e) {
      this.event.set(null);
      const missing = e instanceof ApiError && (e.status === 404 || e.status === 403);
      this.error.set(
        missing
          ? { title: 'Sự kiện không tồn tại hoặc chưa được công bố', hint: 'Có thể sự kiện đã bị gỡ hoặc đường dẫn chưa đúng.', retry: false }
          : { title: 'Chưa tải được sự kiện', hint: 'Kiểm tra kết nối mạng rồi thử lại.', retry: true },
      );
    } finally {
      this.loading.set(false);
    }
  }
}
