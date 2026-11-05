import { Component, inject, signal } from '@angular/core';
import { Api, Catalog } from '../../core/api';
import { EventApi } from './event-api.service';
import { EventEditorComponent } from './event-editor.component';
import { CampusEvent } from './event.models';
import { formatDateTime } from './event-view';

@Component({
  selector: 'app-organizer-events', standalone: true, imports: [EventEditorComponent],
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
  readonly catalogsReady = signal(false);
  readonly hasNext = signal(false);
  readonly editing = signal<CampusEvent | null | undefined>(undefined);
  readonly publishing = signal<CampusEvent | null>(null);
  readonly displayTime = formatDateTime;
  page = 0;

  constructor() {
    void this.load();
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
    } catch {
      this.message.set('Không tải được danh mục khoa/đơn vị. Hãy thử tải lại.');
    }
  }

  async load(): Promise<void> {
    this.busy.set(true);
    this.failed.set(false);
    try {
      const result = await this.events.listOwned(this.page);
      this.items.set(result.items);
      this.hasNext.set(result.hasNext);
    } catch (error) {
      this.failed.set(true);
      this.message.set(error instanceof Error ? error.message : 'Không tải được sự kiện.');
    } finally {
      this.busy.set(false);
    }
  }

  async edit(event: CampusEvent): Promise<void> {
    this.busy.set(true);
    this.message.set('');
    try { this.editing.set(await this.events.getOwned(event.id)); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'Không tải được sự kiện.'); }
    finally { this.busy.set(false); }
  }

  async saved(event: CampusEvent): Promise<void> {
    this.editing.set(undefined);
    this.page = 0;
    this.message.set(event.status === 'DRAFT' ? 'Đã lưu bản nháp.' : 'Đã cập nhật sự kiện.');
    await this.load();
  }

  async publish(): Promise<void> {
    const event = this.publishing();
    if (!event || this.busy()) return;
    this.busy.set(true);
    try {
      await this.events.publish(event);
      this.publishing.set(null);
      this.message.set('Đã công bố sự kiện. Thời gian nhận đăng ký vẫn theo lịch đã cấu hình.');
      await this.load();
    } catch (error) {
      this.publishing.set(null);
      this.message.set(error instanceof Error ? error.message : 'Không công bố được sự kiện. Hãy thử lại.');
    } finally { this.busy.set(false); }
  }

  unitName(id: number): string {
    return this.units().find(unit => unit.id === id)?.name ?? String(id);
  }

  departmentNames(event: CampusEvent): string {
    return event.departmentIds.length
      ? event.departmentIds.map(id => this.departments().find(item => item.id === id)?.name ?? id).join(', ')
      : 'Tất cả khoa';
  }

  changePage(delta: number): void {
    this.page += delta;
    void this.load();
  }
}
