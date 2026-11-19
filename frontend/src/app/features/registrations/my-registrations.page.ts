import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { IconComponent } from '../../shared/icon/icon.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PagerComponent } from '../../shared/pager/pager.component';
import { formatDateTime, formatLongDate, formatTimeRange } from '../../shared/utils/date.utils';
import { mergeQueryParams, pageFromQuery, pageToQuery } from '../../shared/utils/page-query.utils';
import { RegistrationApi } from './registration-api.service';
import { parseStatusFilter, RegistrationPage, STATUS_FILTERS, statusBadge, statusSince } from './registration.models';

/** /my-events: the student's registrations from GET /api/me/registrations (mockup `explore(true)`). */
@Component({
  selector: 'app-my-registrations',
  imports: [PageHeaderComponent, IconComponent, PagerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Sự kiện của tôi" subtitle="Các sự kiện bạn đã đăng ký, đang chờ hoặc đã hủy.">
      <select class="role-select" aria-label="Lọc theo trạng thái" (change)="navigate({ status: $any($event.target).value || null, page: null })">
        @for (f of filters; track f.value) {
          <option [value]="f.value" [selected]="f.value === status()">{{ f.label }}</option>
        }
      </select>
    </app-page-header>

    <section class="panel event-list" [attr.aria-busy]="loading()">
      @if (loading()) {
        <span class="sr-only" role="status">Đang tải đăng ký…</span>
        <div class="skeleton-list" aria-hidden="true">
          @for (row of skeletonRows; track row) {
            <div class="skeleton-row"><span class="sk sk-title"></span><span class="sk sk-badge"></span><span class="sk sk-date"></span><span class="sk sk-action"></span></div>
          }
        </div>
      } @else if (error()) {
        <div class="empty">
          <app-icon name="info" />
          <h3>Chưa tải được danh sách đăng ký</h3>
          <p>{{ error() }}</p>
          <button type="button" class="primary" (click)="load()">Thử lại</button>
        </div>
      } @else if (!rows().length) {
        <div class="empty">
          <app-icon name="calendar" />
          <h3>{{ status() ? 'Không có đăng ký ở trạng thái này' : 'Bạn chưa đăng ký sự kiện nào' }}</h3>
          <p>{{ status() ? 'Thử chọn trạng thái khác.' : 'Khám phá các hoạt động đang mở và đăng ký tham gia.' }}</p>
          <a class="button primary" routerLink="/events">Khám phá sự kiện <app-icon name="arrow" /></a>
        </div>
      } @else {
        <div class="table-scroll">
          <table class="event-table">
            <thead><tr><th>Sự kiện</th><th>Trạng thái</th><th>Thời gian</th><th><span class="sr-only">Thao tác</span></th></tr></thead>
            <tbody>
              @for (r of rows(); track r.id) {
                <tr>
                  <td class="ev-main">
                    <strong>{{ r.eventTitle }}</strong>
                    <small><app-icon name="pin" /> {{ r.location }}</small>
                  </td>
                  <td class="ev-status">
                    <span [class]="r.badge.css">{{ r.badge.label }}</span>
                    @if (r.since) { <small class="muted">từ {{ r.since }}</small> }
                  </td>
                  <td class="ev-date"><span class="nowrap">{{ r.day }}</span><small>{{ r.time }}</small></td>
                  <td class="ev-actions">
                    <a class="button small" [routerLink]="['/events', r.eventId]">Xem chi tiết <app-icon name="arrow" /></a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @if (!loading() && !error()) {
        <app-pager [page]="page()" [hasNext]="result()?.hasNext ?? false" (pageChange)="navigate({ page: pageToQuery($event) })" />
      }
    </section>
  `,
  styles: `
    .ev-status small, .ev-date small { display: block; font-size: 12px; margin-top: 4px; color: var(--muted); }
    .ev-main small app-icon { margin-right: 2px; }
  `,
})
export class MyRegistrationsPage {
  private readonly registrations = inject(RegistrationApi);
  private readonly router = inject(Router);

  protected readonly filters = STATUS_FILTERS;
  protected readonly skeletonRows = [1, 2, 3];
  protected readonly pageToQuery = pageToQuery;
  protected readonly result = signal<RegistrationPage | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  private requestId = 0;

  /** ?status=WAITLISTED&page=2 keeps the view across reloads and Back; the URL is the only copy of this state. */
  private readonly url = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => ({ status: parseStatusFilter(q.get('status')), page: pageFromQuery(q) }))),
    { requireSync: true },
  );
  protected readonly status = computed(() => this.url().status);
  protected readonly page = computed(() => this.url().page);

  /** Display values per row, computed once per response instead of on every change detection. */
  protected readonly rows = computed(() =>
    (this.result()?.items ?? []).map((r) => {
      const since = statusSince(r);
      return {
        ...r,
        badge: statusBadge(r),
        since: since ? formatDateTime(since) : '',
        day: formatLongDate(r.startsAt),
        time: formatTimeRange(r.startsAt, r.endsAt),
      };
    }),
  );

  constructor() {
    effect(() => {
      this.url();
      void this.load();
    });
  }

  protected navigate(queryParams: Record<string, string | number | null>): void {
    mergeQueryParams(this.router, queryParams);
  }

  protected async load(): Promise<void> {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.registrations.mine(this.status(), this.page());
      if (id === this.requestId) this.result.set(result);
    } catch (error) {
      if (id !== this.requestId) return;
      this.result.set(null);
      this.error.set(error instanceof Error ? error.message : 'Kiểm tra kết nối mạng rồi thử lại.');
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }
}
