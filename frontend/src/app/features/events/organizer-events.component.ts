import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { Api, Catalog } from '../../core/api';
import { IconComponent } from '../../shared/icon/icon.component';
import { EventApi } from './event-api.service';
import { EventEditorComponent } from './event-editor.component';
import { CampusEvent } from './event.models';
import { formatDate, formatDateTime, formatLongDate, formatTime, ORGANIZER_BADGE, organizerStatus } from './event-view';

@Component({
  selector: 'app-organizer-events', standalone: true, imports: [EventEditorComponent, IconComponent],
  templateUrl: './organizer-events.component.html'
})
export class OrganizerEventsComponent {
  private readonly events = inject(EventApi);
  private readonly api = inject(Api);
  readonly items = signal<CampusEvent[]>([]);
  readonly departments = signal<Catalog[]>([]);
  readonly units = signal<Catalog[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly failed = signal(false);
  /** True only while the list itself loads (skeleton); busy() also covers edit/publish actions. */
  readonly listLoading = signal(true);
  readonly catalogsFailed = signal(false);
  readonly skeletonRows = [1, 2, 3];
  /** Success notices are green, problems amber. */
  readonly messageTone = signal<'success' | 'warn'>('success');
  readonly catalogsReady = signal(false);
  readonly hasNext = signal(false);
  readonly editing = signal<CampusEvent | null | undefined>(undefined);
  readonly publishing = signal<CampusEvent | null>(null);
  readonly displayTime = formatDateTime;
  readonly time = formatTime;
  readonly longDate = formatLongDate;
  /** End time alone when the event ends the same day, the full date when it runs past midnight. */
  readonly endLabel = (event: CampusEvent) =>
    formatDate(event.endsAt) === formatDate(event.startsAt) ? formatTime(event.endsAt) : formatDateTime(event.endsAt);
  readonly number = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
  readonly badge = (event: CampusEvent) => ORGANIZER_BADGE[organizerStatus(event)];
  page = 0;
  private readonly router = inject(Router);
  /** ?page=2 (1-based) keeps the page across reloads and Back. */
  private readonly urlPage = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => Math.max(0, (Number(q.get('page')) || 1) - 1))),
    { requireSync: true },
  );

  constructor() {
    effect(() => {
      this.page = this.urlPage();
      void this.load();
    });
    void this.loadCatalogs();
  }

  async loadCatalogs(): Promise<void> {
    try {
      const [departments, units] = await Promise.all([
        this.api.request<Catalog[]>('/catalog/departments'),
        this.api.request<Catalog[]>('/catalog/organization-units')
      ]);
      this.departments.set(departments);
      this.units.set(units);
      this.catalogsReady.set(true);
      this.catalogsFailed.set(false);
    } catch {
      this.catalogsFailed.set(true);
    }
  }

  async load(): Promise<void> {
    this.busy.set(true);
    this.listLoading.set(true);
    this.failed.set(false);
    try {
      const result = await this.events.listOwned(this.page);
      this.items.set(result.items);
      this.hasNext.set(result.hasNext);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
      this.listLoading.set(false);
    }
  }

  async edit(event: CampusEvent): Promise<void> {
    this.busy.set(true);
    this.message.set('');
    try { this.editing.set(await this.events.getOwned(event.id)); }
    catch (error) { this.messageTone.set('warn'); this.message.set(error instanceof Error ? error.message : 'Không tải được sự kiện.'); }
    finally { this.busy.set(false); }
  }

  async saved(event: CampusEvent): Promise<void> {
    this.editing.set(undefined);
    this.messageTone.set('success');
    this.message.set(event.status === 'DRAFT' ? 'Đã lưu bản nháp.' : 'Đã cập nhật sự kiện.');
    // Back to page 1 (where new and edited events are listed); the URL drives the reload.
    if (this.page > 0) await this.router.navigate([], { queryParams: { page: null }, queryParamsHandling: 'merge' });
    else await this.load();
  }

  async publish(): Promise<void> {
    const event = this.publishing();
    if (!event || this.busy()) return;
    this.busy.set(true);
    try {
      await this.events.publish(event);
      this.publishing.set(null);
      this.messageTone.set('success');
      this.message.set('Đã công bố sự kiện. Thời gian nhận đăng ký vẫn theo lịch đã cấu hình.');
      await this.load();
    } catch (error) {
      this.publishing.set(null);
      this.messageTone.set('warn');
      this.message.set(error instanceof Error ? error.message : 'Không công bố được sự kiện. Hãy thử lại.');
    } finally { this.busy.set(false); }
  }

  startCreate(): void {
    this.publishing.set(null);
    this.message.set('');
    this.editing.set(null);
  }

  unitName(id: number): string {
    return this.units().find(unit => unit.id === id)?.name ?? '';
  }

  departmentNames(event: CampusEvent): string {
    return event.departmentIds.length
      ? event.departmentIds.map(id => this.departments().find(item => item.id === id)?.name ?? id).join(', ')
      : 'Tất cả khoa';
  }

  changePage(delta: number): void {
    const next = Math.max(0, this.page + delta);
    void this.router.navigate([], { queryParams: { page: next ? next + 1 : null }, queryParamsHandling: 'merge' });
  }
}
