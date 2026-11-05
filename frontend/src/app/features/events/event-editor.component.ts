import { Component, EventEmitter, inject, Input, OnChanges, OnDestroy, Output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Api, ApiError, Catalog } from '../../core/api';
import { IconComponent } from '../../shared/icon/icon.component';
import { ToastService } from '../../shared/toast/toast.service';
import { DateFieldComponent } from '../../shared/form/date-field.component';
import { TimeFieldComponent } from '../../shared/form/time-field.component';
import { EventApi } from './event-api.service';
import { CampusEvent, EventContent, toEventTimestamp, toVietnamInput } from './event.models';

type EventForm = Omit<EventContent, 'organizationUnitId'> & { organizationUnitId: number | null };
type TimeField = 'registrationOpensAt' | 'registrationClosesAt' | 'startsAt' | 'endsAt';

/** The four date-time fields, each edited as a date input plus a time input. */
const TIME_FIELDS: { key: TimeField; label: string; errorId: string }[] = [
  { key: 'registrationOpensAt', label: 'Mở đăng ký', errorId: 'event-open-error' },
  { key: 'registrationClosesAt', label: 'Đóng đăng ký', errorId: 'event-close-error' },
  { key: 'startsAt', label: 'Bắt đầu sự kiện', errorId: 'event-start-error' },
  { key: 'endsAt', label: 'Kết thúc sự kiện', errorId: 'event-end-error' },
];
/** "Năm 5+" stands for these years when the event did not already list its own years >= 5. */
const FIVE_PLUS_DEFAULT = [5, 6, 7, 8];

@Component({
  selector: 'app-event-editor', standalone: true, imports: [FormsModule, IconComponent, DateFieldComponent, TimeFieldComponent],
  templateUrl: './event-editor.component.html'
})
export class EventEditorComponent implements OnChanges, OnDestroy {
  @Input() event: CampusEvent | null = null;
  @Input() departments: Catalog[] = [];
  @Input() units: Catalog[] = [];
  @Output() saved = new EventEmitter<CampusEvent>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly events = inject(EventApi);
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  /** Set after the first save attempt; from then on client errors update live as the user fixes fields. */
  readonly checked = signal(false);
  /** The "check the form" toast belongs to this screen; it is closed when the editor closes. */
  private formToast = 0;
  readonly busy = signal(false);
  readonly message = signal('');
  readonly fields = signal<Record<string, string>>({});
  readonly conflict = signal(false);
  model: EventForm = this.emptyForm();
  readonly timeFields = TIME_FIELDS;
  readonly yearOptions = [1, 2, 3, 4];
  /** Date and time halves per field; the model keeps the joined "YYYY-MM-DDTHH:mm[:ss]" value the API code expects. */
  parts: Record<TimeField, { date: string; time: string }> = this.splitAll(this.model);
  /** Selected study years 1–4, and whether "Năm 5+" is ticked. Empty = no restriction. */
  years = new Set<number>();
  fivePlus = false;
  private fivePlusYears = FIVE_PLUS_DEFAULT;

  ngOnDestroy(): void {
    this.toast.dismiss(this.formToast);
  }

  ngOnChanges(): void {
    this.loadModel(this.event);
  }

  error(name: string, form: NgForm): string {
    if (this.fields()[name]) return this.fields()[name];
    if (this.checked()) {
      const client = this.validate()[name];
      if (client) return client;
    }
    if (form.submitted && form.controls[name]?.invalid) return 'Vui lòng nhập giá trị hợp lệ.';
    return '';
  }

  /**
   * Client-side rules, shown inline before anything is sent. Date order mirrors the database checks
   * (opens < closes <= starts < ends); the server still validates everything.
   */
  validate(): Record<string, string> {
    const m = this.model;
    const e: Record<string, string> = {};
    const title = m.title.trim();
    if (!title) e['title'] = 'Vui lòng nhập tên sự kiện.';
    else if (title.length < 10) e['title'] = 'Tên sự kiện cần ít nhất 10 ký tự.';
    const description = m.description.trim();
    if (!description) e['description'] = 'Vui lòng nhập mô tả.';
    else if (description.length < 20) e['description'] = 'Mô tả cần ít nhất 20 ký tự.';
    if (!m.location.trim()) e['location'] = 'Vui lòng nhập địa điểm.';
    if (m.organizationUnitId === null) e['organizationUnitId'] = 'Vui lòng chọn đơn vị tổ chức.';
    const at = (v: string) => (v ? Date.parse(toEventTimestamp(v)) : NaN);
    const opens = at(m.registrationOpensAt), closes = at(m.registrationClosesAt), starts = at(m.startsAt), ends = at(m.endsAt);
    if (Number.isNaN(opens)) e['registrationOpensAt'] = 'Vui lòng chọn ngày và giờ mở đăng ký.';
    if (Number.isNaN(closes)) e['registrationClosesAt'] = 'Vui lòng chọn ngày và giờ đóng đăng ký.';
    if (Number.isNaN(starts)) e['startsAt'] = 'Vui lòng chọn ngày và giờ bắt đầu.';
    if (Number.isNaN(ends)) e['endsAt'] = 'Vui lòng chọn ngày và giờ kết thúc.';
    // Each broken pair marks both of its fields (date and time inputs) red.
    if (opens >= closes) {
      e['registrationOpensAt'] ??= 'Mở đăng ký phải trước thời điểm đóng đăng ký.';
      e['registrationClosesAt'] ??= 'Mở đăng ký phải trước thời điểm đóng đăng ký.';
    }
    if (closes > starts) {
      e['registrationClosesAt'] ??= 'Đóng đăng ký phải trước hoặc đúng lúc sự kiện bắt đầu.';
      e['startsAt'] ??= 'Đóng đăng ký phải trước hoặc đúng lúc sự kiện bắt đầu.';
    }
    if (starts >= ends) {
      e['startsAt'] ??= 'Thời gian kết thúc phải sau thời gian bắt đầu sự kiện.';
      e['endsAt'] ??= 'Thời gian kết thúc phải sau thời gian bắt đầu sự kiện.';
    }
    if (!Number.isInteger(m.capacity) || m.capacity < 1) e['capacity'] = 'Sức chứa phải là số nguyên dương.';
    return e;
  }

  /** Fields currently invalid (client rules after the first save attempt, plus server-reported fields). */
  errorCount(): number {
    const names = new Set(Object.keys(this.fields()));
    if (this.checked()) Object.keys(this.validate()).forEach((n) => names.add(n));
    return names.size;
  }

  // ── Date + time halves ──
  setPart(key: TimeField, half: 'date' | 'time', value: string): void {
    this.parts[key] = { ...this.parts[key], [half]: value ?? '' };
    const { date, time } = this.parts[key];
    this.model[key] = date && time ? `${date}T${time}` : '';
    // A server message about this field no longer applies once the user changes it.
    if (this.fields()[key]) this.fields.update(({ [key]: _, ...rest }) => rest);
  }

  private splitAll(model: EventForm): Record<TimeField, { date: string; time: string }> {
    const split = (v: string) => ({ date: v ? v.slice(0, 10) : '', time: v ? v.slice(11, 16 + (v.slice(17, 19) && v.slice(17, 19) !== '00' ? 3 : 0)) : '' });
    return {
      registrationOpensAt: split(model.registrationOpensAt), registrationClosesAt: split(model.registrationClosesAt),
      startsAt: split(model.startsAt), endsAt: split(model.endsAt),
    };
  }

  // ── Study years ──
  toggleYear(year: number, on: boolean): void {
    if (on) this.years.add(year); else this.years.delete(year);
  }

  private selectedYears(): number[] {
    return [...[...this.years].sort((a, b) => a - b), ...(this.fivePlus ? this.fivePlusYears : [])];
  }

  // ── Departments ──
  allDepartments(): boolean {
    return this.model.departmentIds.length === 0;
  }

  /** "Tất cả các khoa" = no restriction = empty list; it cannot be unticked into "no department". */
  setAllDepartments(input: HTMLInputElement): void {
    this.model.departmentIds = [];
    input.checked = true;
  }

  toggleDepartment(id: number, on: boolean): void {
    const ids = this.model.departmentIds.filter((x) => x !== id);
    this.model.departmentIds = on ? [...ids, id] : ids;
  }

  /** Bring the first invalid field into view and focus it. */
  private revealFirstError(): void {
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>('.editor-form [aria-invalid="true"]');
      if (!el) return;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    });
  }

  async save(form: NgForm): Promise<void> {
    if (this.busy() || this.conflict()) return;
    this.fields.set({});
    this.message.set('');
    this.checked.set(true);
    if (form.invalid || Object.keys(this.validate()).length) {
      this.formToast = this.toast.error('Vui lòng kiểm tra lại thông tin trước khi lưu.');
      this.revealFirstError();
      return;
    }
    if (!Number.isInteger(this.model.capacity)) {
      this.fields.set({ capacity: 'Sức chứa phải là số nguyên dương.' });
      this.formToast = this.toast.error('Vui lòng kiểm tra lại thông tin trước khi lưu.');
      this.revealFirstError();
      return;
    }
    const years = this.selectedYears();
    this.busy.set(true);
    const content: EventContent = {
      ...this.model, organizationUnitId: this.model.organizationUnitId!, studyYears: years,
      title: this.model.title.trim(), description: this.model.description.trim(), location: this.model.location.trim(),
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
    this.parts = this.splitAll(this.model);
    const list = event?.studyYears ?? [];
    this.years = new Set(list.filter((y) => y >= 1 && y <= 4));
    const high = list.filter((y) => y >= 5);
    this.fivePlus = high.length > 0;
    this.fivePlusYears = high.length ? high : FIVE_PLUS_DEFAULT;
    this.fields.set({});
    this.conflict.set(false);
    this.checked.set(false);
    this.message.set('');
  }
}
