import { ChangeDetectionStrategy, Component, computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { IconComponent } from '../../shared/icon/icon.component';
import { formatLongDate } from '../../shared/utils/date.utils';
import { EventApi } from './event-api.service';
import { CampusEvent } from './event.models';

/** Largest page GET /organizer/events accepts; the API has no status filter yet, drafts are dropped here. */
const PICKER_SIZE = 100;

/**
 * "Which of my published events?" for organizer pages (/participants, /attendance, /reports).
 * The choice lives in the URL as ?event=<id> so links, reload and Back keep it; without (or with an unknown)
 * id the newest published event is used. Provide it per page: `providers: [OwnedEventPicker]`.
 */
@Injectable()
export class OwnedEventPicker {
  private readonly eventApi = inject(EventApi);
  private readonly router = inject(Router);
  private readonly wanted = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => Number(q.get('event')) || null)), {
    requireSync: true,
  });

  readonly events = signal<CampusEvent[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selected = computed(() => {
    const list = this.events();
    return list.find((e) => e.id === this.wanted()) ?? list.at(0) ?? null;
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.eventApi.listOwned(0, PICKER_SIZE);
      this.events.set(page.items.filter((e) => e.status === 'PUBLISHED'));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Kiểm tra kết nối mạng rồi thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Switching event resets the other list parameters (page, filters) of the page. */
  select(id: number): void {
    void this.router.navigate([], { queryParams: { event: id } });
  }
}

/** The <select> for the page header; renders nothing until there is something to choose. */
@Component({
  selector: 'app-owned-event-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (picker.events().length) {
      <select class="event-select" aria-label="Chọn sự kiện" (change)="picker.select(+$any($event.target).value)">
        @for (e of picker.events(); track e.id) {
          <option [value]="e.id" [selected]="e.id === picker.selected()?.id">{{ e.title }} · {{ date(e.startsAt) }}</option>
        }
      </select>
    }
  `,
  styles: `.event-select { min-width: 240px; }`,
})
export class OwnedEventSelectComponent {
  protected readonly picker = inject(OwnedEventPicker);
  protected readonly date = formatLongDate;
}

/**
 * Loading / error / "no published event" states shown instead of the page body;
 * the page renders its body with `@if (picker.selected(); as event)`.
 */
@Component({
  selector: 'app-owned-event-states',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (picker.loading()) {
      <span class="sr-only" role="status">Đang tải sự kiện…</span>
      <div class="stats" aria-hidden="true">
        @for (n of skeleton; track n) { <div class="stat"><span class="sk sk-line short"></span><span class="sk sk-line heading"></span></div> }
      </div>
    } @else if (picker.error()) {
      <div class="empty">
        <app-icon name="info" />
        <h3>Chưa tải được danh sách sự kiện</h3>
        <p>{{ picker.error() }}</p>
        <button type="button" class="primary" (click)="picker.load()">Thử lại</button>
      </div>
    } @else if (!picker.events().length) {
      <div class="empty panel">
        <app-icon name="users" />
        <h3>Chưa có sự kiện nào được công bố</h3>
        <p>Chỉ sự kiện đã công bố mới có đăng ký và điểm danh. Hãy công bố một sự kiện trước.</p>
        <a class="button primary" routerLink="/manage">Đến Sự kiện quản lý <app-icon name="arrow" /></a>
      </div>
    }
  `,
})
export class OwnedEventStatesComponent {
  protected readonly picker = inject(OwnedEventPicker);
  protected readonly skeleton = [1, 2, 3, 4];
}
