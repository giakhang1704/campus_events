import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { Catalog } from '../../core/api';
import { catalogName, CatalogService } from '../../core/catalog.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { initials } from '../../shared/initials';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PagerComponent } from '../../shared/pager/pager.component';
import { ToastService } from '../../shared/toast/toast.service';
import { formatDateTime } from '../../shared/utils/date.utils';
import { formatCount } from '../../shared/utils/number.utils';
import { mergeQueryParams, pageFromQuery, pageToQuery } from '../../shared/utils/page-query.utils';
import { OwnedEventPicker, OwnedEventSelectComponent, OwnedEventStatesComponent } from '../events/owned-event-picker';
import { RegistrationApi } from './registration-api.service';
import { ParticipantPage, parseStatusFilter, STATUS_FILTERS, statusBadge, statusSince } from './registration.models';

/** /participants: registrations of one owned event from GET /api/organizer/events/{id}/registrations (mockup `participants()`). */
@Component({
  selector: 'app-participants',
  imports: [PageHeaderComponent, IconComponent, PagerComponent, OwnedEventSelectComponent, OwnedEventStatesComponent],
  providers: [OwnedEventPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Danh sách người tham gia" subtitle="Theo dõi danh sách chính thức và thứ tự chờ của từng sự kiện.">
      <app-owned-event-select />
    </app-page-header>

    <app-owned-event-states />
    @if (picker.selected()) {
      @if (result(); as s) {
        <div class="stats">
          <div class="stat green"><div class="stat-top">Đã đăng ký <app-icon name="check" /></div><strong>{{ count(s.registeredCount) }}</strong><small>trên {{ count(s.capacity) }} chỗ</small></div>
          <div class="stat amber"><div class="stat-top">Danh sách chờ <app-icon name="clock" /></div><strong>{{ count(s.waitingCount) }}</strong><small>tự chuyển lên khi có chỗ</small></div>
          <div class="stat"><div class="stat-top">Còn trống <app-icon name="grid" /></div><strong>{{ count(free()) }}</strong><small>chỗ</small></div>
          <div class="stat"><div class="stat-top">Lấp đầy <app-icon name="chart" /></div><strong>{{ fill() }}%</strong><small>sức chứa</small></div>
        </div>
      }

      <div class="toolbar">
        <label class="search">
          <app-icon name="search" />
          <input aria-label="Tìm trong trang này" placeholder="Tìm họ tên, MSSV hoặc email trong trang này…" maxlength="100"
            [value]="search()" (input)="search.set($any($event.target).value)" />
        </label>
        <select class="role-select" aria-label="Lọc theo trạng thái" (change)="navigate({ status: $any($event.target).value || null, page: null })">
          @for (f of filters; track f.value) { <option [value]="f.value" [selected]="f.value === status()">{{ f.label }}</option> }
        </select>
        <button type="button" class="small" [disabled]="loading()" (click)="load()">Tải lại</button>
      </div>
      <section class="panel" [attr.aria-busy]="loading()">

        @if (loading()) {
          <span class="sr-only" role="status">Đang tải người tham gia…</span>
          <div class="skeleton-list" aria-hidden="true">
            @for (row of skeletonRows; track row) {
              <div class="skeleton-row"><span class="sk sk-title"></span><span class="sk sk-badge"></span><span class="sk sk-date"></span></div>
            }
          </div>
        } @else if (error()) {
          <div class="empty">
            <app-icon name="info" />
            <h3>Chưa tải được danh sách người tham gia</h3>
            <p>{{ error() }}</p>
            <button type="button" class="primary" (click)="load()">Thử lại</button>
          </div>
        } @else if (!rows().length) {
          <div class="empty">
            <app-icon name="users" />
            <h3>{{ search() ? 'Không có người phù hợp trong trang này' : status() ? 'Không có ai ở trạng thái này' : 'Chưa có sinh viên đăng ký' }}</h3>
            <p>{{ search() ? 'Thử từ khóa khác hoặc chuyển trang.' : 'Danh sách sẽ cập nhật khi sinh viên đăng ký.' }}</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table>
              <thead><tr><th>Sinh viên</th><th>MSSV</th><th>Khoa · Năm</th><th>Trạng thái</th><th>Thời điểm</th></tr></thead>
              <tbody>
                @for (p of rows(); track p.id) {
                  <tr>
                    <td>
                      <div class="person-cell">
                        <span class="avatar">{{ p.initials }}</span>
                        <div><strong>{{ p.fullName }}</strong><small>{{ p.email }}</small></div>
                      </div>
                    </td>
                    <td class="nowrap">{{ p.studentCode }}</td>
                    <td>{{ p.department }}<small>Năm {{ p.studyYear }}</small></td>
                    <td><span [class]="p.badge.css">{{ p.badge.label }}</span></td>
                    <td class="nowrap">{{ p.since }}</td>
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
    }
  `,
  styles: `
    .event-select { min-width: 240px; }
    td small { display: block; }
  `,
})
export class ParticipantsPage {
  private readonly registrations = inject(RegistrationApi);
  private readonly catalogs = inject(CatalogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly filters = STATUS_FILTERS;
  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly pageToQuery = pageToQuery;

  protected readonly picker = inject(OwnedEventPicker);
  private readonly departments = signal<Catalog[]>([]);

  /** Last response: items, hasNext and the counters shown in the stat cards. */
  protected readonly result = signal<ParticipantPage | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  /** Filters the loaded page; a different event starts with an empty search. */
  protected readonly search = linkedSignal({ source: () => this.picker.selectedId(), computation: () => '' });
  private requestId = 0;

  /** ?event=12&status=WAITLISTED&page=2 keeps the view across reloads and Back; links from /manage use it. */
  private readonly url = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => ({ status: parseStatusFilter(q.get('status')), page: pageFromQuery(q) }))),
    { requireSync: true },
  );
  protected readonly status = computed(() => this.url().status);
  protected readonly page = computed(() => this.url().page);
  private readonly eventId = this.picker.selectedId;

  /** Display values per row, computed once per response/catalog change instead of on every change detection. */
  private readonly allRows = computed(() => {
    const departments = this.departments();
    return (this.result()?.items ?? []).map((p) => {
      const since = statusSince(p);
      return {
        ...p,
        initials: initials(p.fullName),
        department: catalogName(departments, p.departmentId) ?? `Khoa #${p.departmentId}`,
        badge: statusBadge(p),
        since: since ? formatDateTime(since) : '—',
        haystack: [p.fullName, p.studentCode, p.email].join(' ').toLocaleLowerCase('vi'),
      };
    });
  });
  /** Search filters the loaded page only (the API has no search parameter). */
  protected readonly rows = computed(() => {
    const term = this.search().trim().toLocaleLowerCase('vi');
    return term ? this.allRows().filter((p) => p.haystack.includes(term)) : this.allRows();
  });
  protected readonly free = computed(() => {
    const s = this.result();
    return s ? Math.max(0, s.capacity - s.registeredCount) : 0;
  });
  protected readonly fill = computed(() => {
    const s = this.result();
    return s && s.capacity ? Math.round((s.registeredCount / s.capacity) * 100) : 0;
  });

  protected readonly count = formatCount;

  constructor() {
    this.catalogs.getDepartments().then((d) => this.departments.set(d)).catch(() => this.toast.error('Chưa tải được danh mục khoa; tên khoa có thể chưa hiện.'));
    effect(() => {
      this.url();
      if (this.eventId()) void this.load();
    });
  }

  protected navigate(queryParams: Record<string, string | number | null>): void {
    mergeQueryParams(this.router, queryParams);
  }

  async load(): Promise<void> {
    const eventId = this.eventId();
    if (!eventId) return;
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.registrations.participants(eventId, this.status(), this.page());
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
