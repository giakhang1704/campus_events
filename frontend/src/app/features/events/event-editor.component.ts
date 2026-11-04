import { Component, EventEmitter, inject, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Api, ApiError, Catalog } from '../../core/api';
import { EventApi } from './event-api.service';
import { CampusEvent, EventContent, toEventTimestamp, toVietnamInput } from './event.models';

type EventForm = Omit<EventContent, 'organizationUnitId'> & { organizationUnitId: number | null };

@Component({
  selector: 'app-event-editor', standalone: true, imports: [FormsModule],
  templateUrl: './event-editor.component.html'
})
export class EventEditorComponent implements OnChanges {
  @Input() event: CampusEvent | null = null;
  @Input() departments: Catalog[] = [];
  @Input() units: Catalog[] = [];
  @Output() saved = new EventEmitter<CampusEvent>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly events = inject(EventApi);
  private readonly api = inject(Api);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly fields = signal<Record<string, string>>({});
  readonly conflict = signal(false);
  model: EventForm = this.emptyForm();
  studyYearsText = '';

  ngOnChanges(): void {
    this.loadModel(this.event);
  }

  error(name: string, form: NgForm): string {
    if (this.fields()[name]) return this.fields()[name];
    if (form.submitted && form.controls[name]?.invalid) return 'Vui lòng nhập giá trị hợp lệ.';
    return '';
  }

  async save(form: NgForm): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.fields.set({});
    this.message.set('');
    if (form.invalid) {
      this.message.set('Vui lòng kiểm tra các trường được đánh dấu.');
      return;
    }
    if (!Number.isInteger(this.model.capacity)) {
      this.fields.set({ capacity: 'Sức chứa phải là số nguyên dương.' });
      return;
    }
    const years = this.studyYearsText.trim() ? this.studyYearsText.trim().split(/[,;\s]+/).map(Number) : [];
    if (years.some(year => !Number.isInteger(year) || year < 1 || year > 32767)) {
      this.fields.set({ studyYears: 'Nhập các năm học nguyên dương, ngăn cách bằng dấu phẩy (tối đa 32767).' });
      return;
    }
    this.busy.set(true);
    const content: EventContent = {
      ...this.model, organizationUnitId: this.model.organizationUnitId!, studyYears: years,
      registrationOpensAt: toEventTimestamp(this.model.registrationOpensAt),
      registrationClosesAt: toEventTimestamp(this.model.registrationClosesAt),
      startsAt: toEventTimestamp(this.model.startsAt), endsAt: toEventTimestamp(this.model.endsAt)
    };
    try {
      const saved = this.event
        ? await this.events.update(this.event.id, { ...content, version: this.event.version })
        : await this.events.create(content);
      this.saved.emit(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        this.fields.set(error.fields);
        this.conflict.set(error.code === 'VERSION_CONFLICT');
      }
      this.message.set(error instanceof Error ? error.message : 'Không lưu được sự kiện. Vui lòng thử lại.');
    } finally {
      this.busy.set(false);
    }
  }

  async reload(): Promise<void> {
    if (!this.event || this.busy()) return;
    this.busy.set(true);
    try {
      const latest = await this.events.getOwned(this.event.id);
      this.event = latest;
      this.loadModel(latest);
      this.message.set('Đã tải bản mới. Vui lòng đối chiếu trước khi lưu.');
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'Không tải được sự kiện.');
    } finally {
      this.busy.set(false);
    }
  }

  private emptyForm(): EventForm {
    return {
      title: '', description: '', location: '', organizationUnitId: this.api.user()?.organizationUnitId ?? null,
      registrationOpensAt: '', registrationClosesAt: '', startsAt: '', endsAt: '', capacity: 100,
      departmentIds: [], studyYears: []
    };
  }

  private loadModel(event: CampusEvent | null): void {
    this.model = event ? {
      title: event.title, description: event.description, location: event.location,
      organizationUnitId: event.organizationUnitId, capacity: event.capacity,
      departmentIds: [...event.departmentIds], studyYears: [...event.studyYears],
      registrationOpensAt: toVietnamInput(event.registrationOpensAt),
      registrationClosesAt: toVietnamInput(event.registrationClosesAt),
      startsAt: toVietnamInput(event.startsAt), endsAt: toVietnamInput(event.endsAt)
    } : this.emptyForm();
    this.studyYearsText = event?.studyYears.join(', ') ?? '';
    this.fields.set({});
    this.conflict.set(false);
    this.message.set('');
  }
}
