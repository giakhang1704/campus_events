import { ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, isDevMode, OnDestroy, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, Scroll } from '@angular/router';
import { filter, map } from 'rxjs';

import { Catalog } from '../../core/api';
import { CatalogService } from '../../core/catalog.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { ToastService } from '../../shared/toast/toast.service';
import { FIXTURE_UNITS, FIXTURES, FixtureKey } from './dev/event-fixtures';
import { FixtureToggleComponent } from './dev/fixture-toggle.component';
import { EventApi } from './event-api.service';
import { CampusEvent, EventPage } from './event.models';
import { registrationWindow } from './event-view';
import { PublicEventCardComponent } from './public-event-card.component';

/** Matches GET /api/events' default page size, so a fixture page looks like a real one. */
const PAGE_SIZE = 9;
/**
 * Debounce: search only once the user has paused typing for this long, not on every keystroke.
 * Typing "hiến máu" is 8 keystrokes; without a pause we would send 8 requests and the list would flicker.
 * About 300-400 ms is the usual gap between keystrokes of someone still typing, so 350 ms waits for the
 * pause without feeling slow.
 */
const SEARCH_DEBOUNCE_MS = 350;

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
      @for (event of items(); track event.id) {
        <app-public-event-card [event]="event" [unitName]="unitName(event.organizationUnitId)" />
      } @empty {
        @if (loading()) {
          <span class="sr-only" role="status">Đang tải sự kiện…</span>
          @for (n of skeletonCards; track n) {
            <div class="card card-skeleton" aria-hidden="true">
              <div class="sk sk-poster"></div>
              <div class="card-body">
                <span class="sk sk-line short"></span>
                <span class="sk sk-line title"></span>
                <span class="sk sk-line"></span>
                <span class="sk sk-line"></span>
                <span class="sk sk-line short"></span>
              </div>
            </div>
          }
        } @else if (!error()) {
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

    @if (fixtureSwitch()) {
      <!-- DEV ONLY: shown in dev builds when the URL carries ?data=…; never in production. -->
      <app-fixture-toggle />
    }
  `,
})
export class StudentEventsPage implements OnDestroy {
  private readonly events = inject(EventApi);
  private readonly catalogs = inject(CatalogService);
  private readonly toast = inject(ToastService);
  /** Placeholder cards shown while the first page loads (one row on desktop). */
  protected readonly skeletonCards = [1, 2, 3];

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
  private readonly query$ = inject(ActivatedRoute).queryParamMap;
  private readonly fixture = toSignal(
    this.query$.pipe(map((q) => (this.devMode ? (q.get('data') as FixtureKey | null) : null))),
    { initialValue: null },
  );
  /** Open the switch with /events?data=api (live API) or ?data=demo|worst|empty|one|huge. */
  protected readonly fixtureSwitch = toSignal(this.query$.pipe(map((q) => this.devMode && q.has('data'))), { initialValue: false });

  private readonly router = inject(Router);
  /** Search and page live in the URL (?q=…&page=2, page is 1-based there) so reload and Back keep the view. */
  private readonly urlState = toSignal(
    this.query$.pipe(map((q) => ({ q: q.get('q') ?? '', page: Math.max(0, (Number(q.get('page')) || 1) - 1) }))),
    { requireSync: true },
  );

  private readonly scroller = inject(ViewportScroller);
  /**
   * Back/Forward position for this list. The router restores it before the cards are loaded
   * (the page is still short), so it is applied again once the list has rendered.
   */
  private pendingScroll: [number, number] | null = null;
  /** The router's Back/Forward scroll position as a signal (no manual subscribe; Angular cleans it up). */
  private readonly restoredPosition = toSignal(
    this.router.events.pipe(
      filter((event): event is Scroll => event instanceof Scroll && !!event.position),
      map((event) => event.position),
    ),
    { initialValue: null },
  );

  constructor() {
    // Remember a Back/Forward position until the list has loaded (applied at the end of load()).
    effect(() => {
      const position = this.restoredPosition();
      if (position) this.pendingScroll = position;
    });
    effect(() => {
      const key = this.fixture();
      if (key && FIXTURES[key]) this.units.set(FIXTURE_UNITS);
      else this.catalogs.getUnits().then((units) => this.units.set(units)).catch(() => this.toast.error('Chưa tải được danh mục đơn vị tổ chức. Tên đơn vị có thể chưa hiện; hãy tải lại trang.'));
    });
    effect(() => {
      this.fixture();
      const { q, page } = this.urlState();
      this.query.set(q);
      this.page.set(page);
      void this.load();
    });
  }

  /** Same contract as GET /api/events (server-side search, 9 per page), over a dev fixture. */
  private fixturePage(key: FixtureKey, q: string, page: number, size = PAGE_SIZE): EventPage {
    const keyword = q.toLocaleLowerCase('vi');
    const matches = FIXTURES[key].filter(
      (event) => !keyword || [event.title, event.description, event.location].some((field) => field.toLocaleLowerCase('vi').includes(keyword)),
    );
    const firstIndex = page * size;
    return { items: matches.slice(firstIndex, firstIndex + size), page, size, hasNext: matches.length > firstIndex + size };
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  /** The screen's finding: how many of the listed events take registrations right now. */
  protected readonly headline = computed(() => {
    if (this.loading()) return 'Đang tải sự kiện…';
    const n = this.items().length;
    if (!n) return this.query() ? 'Không có sự kiện phù hợp với từ khóa.' : 'Chưa có sự kiện nào được công bố.';
    const open = this.items().filter((event) => registrationWindow(event) === 'OPEN').length;
    const scope = this.hasNext() || this.page() > 0 ? ' trên trang này' : '';
    return open ? `${open} trong ${n} sự kiện${scope} đang nhận đăng ký.` : `${n} sự kiện${scope}, chưa có sự kiện nào đang nhận đăng ký.`;
  });

  protected unitName(id: number): string {
    return this.units().find((unit) => unit.id === id)?.name ?? '';
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    // Typing replaces the history entry instead of adding one per keystroke.
    this.searchTimer = setTimeout(() => this.setUrl({ q: value.trim() || null, page: null }, true), SEARCH_DEBOUNCE_MS);
  }

  protected go(delta: number): void {
    const next = Math.max(0, this.page() + delta);
    this.setUrl({ page: next ? next + 1 : null }, false);
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  private setUrl(queryParams: Record<string, string | number | null>, replaceUrl: boolean): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl });
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
    } catch (error) {
      if (id !== this.requestId) return;
      this.items.set([]);
      this.hasNext.set(false);
      this.error.set(error instanceof Error ? error.message : 'Không tải được danh sách sự kiện.');
    } finally {
      if (id === this.requestId) {
        this.loading.set(false);
        const position = this.pendingScroll;
        this.pendingScroll = null;
        // Wait one frame so the cards are in the DOM before scrolling back to them.
        if (position) requestAnimationFrame(() => this.scroller.scrollToPosition(position));
      }
    }
  }
}
