import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ApiError } from '../../core/api';
import { IconComponent } from '../../shared/icon/icon.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PagerComponent } from '../../shared/pager/pager.component';
import { ToastService } from '../../shared/toast/toast.service';
import { formatDateTime } from '../../shared/utils/date.utils';
import { errorMessage } from '../../shared/utils/error.utils';
import { formatCount } from '../../shared/utils/number.utils';
import { mergeQueryParams, pageFromQuery, pageToQuery } from '../../shared/utils/page-query.utils';
import { AttendanceApi } from '../attendance/attendance-api.service';
import { ATTENDANCE_FILTERS, ATTENDANCE_STATE_BADGE, AttendanceListPage, METHOD_LABEL, parseAttendanceFilter } from '../attendance/attendance.models';
import { OwnedEventPicker, OwnedEventSelectComponent, OwnedEventStatesComponent } from '../events/owned-event-picker';
import { STATUS_BADGE } from '../registrations/registration.models';

/** Organizer report. The list response contains its summary in the same database snapshot. */
@Component({
  selector: 'app-reports',
  imports: [PageHeaderComponent, IconComponent, PagerComponent, OwnedEventSelectComponent, OwnedEventStatesComponent],
  providers: [OwnedEventPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.css',
})
export class ReportsPage {
  private readonly attendance = inject(AttendanceApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly picker = inject(OwnedEventPicker);
  protected readonly filters = ATTENDANCE_FILTERS;
  protected readonly count = formatCount;
  protected readonly stamp = formatDateTime;
  protected readonly pageToQuery = pageToQuery;
  protected readonly skeleton = [1, 2, 3, 4];

  private readonly url = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((query) => ({
    filter: parseAttendanceFilter(query.get('status')),
    page: Math.min(100000, Math.floor(pageFromQuery(query))) || 0,
  }))), { requireSync: true });
  protected readonly filter = computed(() => this.url().filter);
  protected readonly page = computed(() => this.url().page);
  private readonly eventId = this.picker.selectedId;

  protected readonly result = signal<AttendanceListPage | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly exporting = signal(false);
  protected readonly exportError = signal('');
  protected readonly summary = computed(() => this.result()?.summary ?? null);
  protected readonly filterLabel = computed(() => this.filters.find((f) => f.value === this.filter())!.label);
  protected readonly rows = computed(() => (this.result()?.items ?? []).map((row) => ({
    ...row,
    badge: ATTENDANCE_STATE_BADGE[row.attendanceState],
    registrationBadge: STATUS_BADGE[row.registrationStatus],
    // Cancelled registrations can retain old PRESENT evidence: use the derived state, not raw result.
    recorded: row.attendanceState !== 'NOT_APPLICABLE' && row.method && row.recordedAt
      ? `${METHOD_LABEL[row.method]} · ${formatDateTime(row.recordedAt)}` : '—',
  })));
  protected readonly rate = computed(() => {
    const rate = this.summary()?.attendanceRate;
    return rate == null ? 'Không áp dụng' : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(rate)}%`;
  });

  private requestId = 0;
  private exportId = 0;
  private destroyed = false;
  private readonly downloadUrls = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    effect(() => {
      this.url();
      this.eventId();
      untracked(() => void this.load());
    });
    // Discard a download from the previous event/filter, including a request that finishes much later.
    effect(() => {
      this.eventId();
      this.filter();
      untracked(() => {
        this.exportId++;
        this.exporting.set(false);
        this.exportError.set('');
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.requestId++;
      this.exportId++;
      for (const [url, timer] of this.downloadUrls) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
    });
  }

  protected navigate(queryParams: Record<string, string | number | null>): void {
    mergeQueryParams(this.router, queryParams);
  }

  protected setFilter(value: string): void {
    const filter = parseAttendanceFilter(value);
    this.navigate({ event: this.eventId(), status: filter === 'REGISTERED' ? null : filter, page: null });
  }

  async load(): Promise<void> {
    const id = ++this.requestId;
    const eventId = this.eventId();
    const filter = this.filter();
    const page = this.page();
    const current = () => !this.destroyed && id === this.requestId && eventId === this.eventId() && filter === this.filter() && page === this.page();
    this.result.set(null);
    this.error.set('');
    this.loading.set(!!eventId);
    if (!eventId) return;
    try {
      const result = await this.attendance.list(eventId, filter, page);
      if (current()) this.result.set(result);
    } catch (error) {
      if (current()) this.error.set(errorMessage(error));
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async exportCsv(): Promise<void> {
    const eventId = this.eventId();
    if (!eventId || this.exporting() || this.loading() || !this.result() || this.error()) return;
    const filter = this.filter();
    const id = ++this.exportId;
    const current = () => !this.destroyed && id === this.exportId && eventId === this.eventId() && filter === this.filter();
    this.exporting.set(true);
    this.exportError.set('');
    try {
      // Download the complete server export for the filter, never just the visible page.
      const blob = await this.attendance.reportCsv(eventId, filter);
      if (!current()) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bk-event-${eventId}-report-${filter.toLowerCase()}.csv`;
      document.body.appendChild(link);
      try { link.click(); } finally {
        link.remove();
        this.downloadUrls.set(url, setTimeout(() => {
          URL.revokeObjectURL(url);
          this.downloadUrls.delete(url);
        }, 1000));
      }
      this.toast.success('Đã tải báo cáo CSV.');
    } catch (error) {
      if (current()) this.exportError.set(error instanceof ApiError && error.code === 'REPORT_TOO_LARGE'
        ? 'Bản xuất vượt giới hạn 10.000 dòng. Hãy chọn một trạng thái đăng ký cụ thể rồi tải lại.'
        : errorMessage(error, 'Chưa tải được CSV. Vui lòng thử lại.'));
    } finally {
      if (current()) this.exporting.set(false);
    }
  }
}
