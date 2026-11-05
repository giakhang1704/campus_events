import { ChangeDetectionStrategy, Component, computed, effect, inject, isDevMode, OnDestroy, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { Catalog } from '../../core/api';
import { CatalogService } from '../../core/catalog.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { EventApi } from './event-api.service';
import { CampusEvent } from './event.models';
import { PublicEventCardComponent } from './public-event-card.component';
import { registrationWindow } from './event-view';
import { FIXTURE_UNITS, FIXTURES, FixtureKey } from './dev/event-fixtures';
import { FixtureToggleComponent } from './dev/fixture-toggle.component';
import { EventPage } from './event.models';

/** /events: published events from GET /api/events (mockup `explore()`). */
@Component({
  selector: 'app-student-events',
  imports: [PageHeaderComponent, IconComponent, PublicEventCardComponent, FixtureToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Khám phá sự kiện" [subtitle]="headline()" />

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

    @if (devMode) {
      <!-- DEV ONLY: data source switch, never rendered in production builds. -->
      <app-fixture-toggle />
    }
  `,
})
export class StudentEventsPage implements OnDestroy {
  private readonly events = inject(EventApi);
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

  // DEV ONLY: ?data=demo|worst|empty|one|huge swaps the API for a fixture at this boundary.
  protected readonly devMode = isDevMode();
  private readonly fixture = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => (this.devMode ? (q.get('data') as FixtureKey | null) : null))),
    { initialValue: null },
  );

  constructor() {
    effect(() => {
      const key = this.fixture();
      this.page.set(0);
      void this.load();
      if (key && FIXTURES[key]) this.units.set(FIXTURE_UNITS);
      else this.catalogs.getUnits().then((u) => this.units.set(u)).catch(() => {});
    });
  }

  /** Same contract as GET /api/events (server-side search, 9 per page), over a dev fixture. */
  private fixturePage(key: FixtureKey, q: string, page: number, size = 9): EventPage {
    const needle = q.toLocaleLowerCase('vi');
    const rows = FIXTURES[key].filter((e) => !needle || [e.title, e.description, e.location].some((v) => v.toLocaleLowerCase('vi').includes(needle)));
    return { items: rows.slice(page * size, page * size + size), page, size, hasNext: rows.length > (page + 1) * size };
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  /** The screen's finding: how many of the listed events take registrations right now. */
  protected readonly headline = computed(() => {
    if (this.loading()) return 'Đang tải sự kiện…';
    const n = this.items().length;
    if (!n) return this.query() ? 'Không có sự kiện phù hợp với từ khóa.' : 'Chưa có sự kiện nào được công bố.';
    const open = this.items().filter((e) => registrationWindow(e) === 'OPEN').length;
    const scope = this.hasNext() || this.page() > 0 ? ' trên trang này' : '';
    return open ? `${open} trong ${n} sự kiện${scope} đang nhận đăng ký.` : `${n} sự kiện${scope}, chưa có sự kiện nào đang nhận đăng ký.`;
  });

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
      const key = this.fixture();
      const result = key && FIXTURES[key] ? this.fixturePage(key, this.query().trim(), this.page()) : await this.events.listPublished(this.query().trim(), this.page());
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
