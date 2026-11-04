import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, Catalog } from '../../core/api';
import { CatalogService } from '../../core/catalog.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { EventApi } from './event-api.service';
import { CampusEvent } from './event.models';
import { formatDayMonth, formatLongDate, formatTime, isEligible, posterColor, registrationWindow, WINDOW_BADGE } from './event-view';

/** /events/:id: published event detail from GET /api/events/{id} (mockup `detail()`). */
@Component({
  selector: 'app-student-event-detail',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="text-button back" routerLink="/events"><app-icon name="back" /> Quay lại danh sách</a>

    @if (loading()) {
      <p class="muted" role="status">Đang tải sự kiện…</p>
    } @else if (error()) {
      <div class="empty">
        <app-icon name="info" />
        <h3>Không xem được sự kiện</h3>
        <p>{{ error() }}</p>
        <a class="text-button" routerLink="/events">Về danh sách sự kiện <app-icon name="arrow" /></a>
      </div>
    } @else if (event(); as e) {
      <div class="split">
        <section class="panel detail-copy">
          <div [class]="posterClass()">
            <small>{{ unitName() }}</small>
            <strong>{{ e.title }}</strong>
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
          <div class="info-row"><span>Sức chứa</span><b>{{ e.capacity }} người</b></div>
          <div class="info-row"><span>Nhận đăng ký</span><b>{{ stamp(e.registrationOpensAt) }} → {{ stamp(e.registrationClosesAt) }}</b></div>
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
  protected readonly error = signal('');
  private readonly departments = signal<Catalog[]>([]);
  private readonly units = signal<Catalog[]>([]);

  protected readonly posterClass = computed(() => 'poster detail-poster ' + (this.event() ? posterColor(this.event()!) : ''));
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
  /** "08:00 12/11" in Vietnam time. */
  protected stamp(iso: string): string {
    return `${formatTime(iso)} ${formatDayMonth(iso)}`;
  }

  constructor() {
    this.catalogs.getDepartments().then((d) => this.departments.set(d)).catch(() => {});
    this.catalogs.getUnits().then((u) => this.units.set(u)).catch(() => {});
    effect(() => {
      void this.load(Number(this.id()));
    });
  }

  private async load(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      if (!Number.isInteger(id) || id <= 0) throw new Error('Đường dẫn sự kiện không hợp lệ.');
      this.event.set(await this.events.getPublished(id));
    } catch (e) {
      this.event.set(null);
      this.error.set(e instanceof Error ? e.message : 'Không tải được sự kiện.');
    } finally {
      this.loading.set(false);
    }
  }
}
