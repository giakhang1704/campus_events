import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, linkedSignal, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDateTime } from '../../shared/utils/date.utils';
import { errorMessage } from '../../shared/utils/error.utils';
import { CampusEvent } from '../events/event.models';
import { Registration } from '../registrations/registration.models';
import { AttendanceApi } from './attendance-api.service';
import { ATTENDANCE_STATE_BADGE, METHOD_LABEL, MyAttendance, QR_OPENS_BEFORE_START_MS } from './attendance.models';

/** Student-only attendance summary. Registration version changes invalidate the previous result. */
@Component({
  selector: 'app-my-attendance',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="my-attendance" aria-label="Điểm danh của bạn" [attr.aria-busy]="loading()">
      <div class="attendance-heading">
        <h3>Điểm danh</h3>
        <button type="button" class="small" aria-label="Tải lại điểm danh" [disabled]="loading()" (click)="refreshRequested.emit()">Tải lại</button>
      </div>
      @if (loading()) {
        <p class="small-text muted" role="status">Đang tải điểm danh…</p>
      } @else if (error()) {
        <p class="small-text" role="alert">{{ error() }}</p>
        <button type="button" class="small" (click)="load()">Thử lại</button>
      } @else {
        <span [class]="badge().css">{{ badge().label }}</span>
        @if (present(); as recorded) {
          <p class="small-text muted recorded-at">{{ stamp(recorded.recordedAt) }} · {{ method(recorded.method) }}</p>
        } @else if (canScan()) {
          <a class="button primary block scan-link" routerLink="/scan">Quét QR điểm danh</a>
        } @else if (beforeWindow()) {
          <p class="small-text muted recorded-at">Mở từ {{ stamp(opensAt()) }}.</p>
        }
      }
    </section>
  `,
  styles: `
    :host { display: block; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line); }
    .attendance-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .attendance-heading h3 { margin: 0; }
    .recorded-at { margin-top: 10px; overflow-wrap: anywhere; }
    .scan-link { display: flex; width: 100%; margin-top: 14px; }
  `,
})
export class MyAttendanceComponent {
  readonly event = input.required<CampusEvent>();
  readonly registration = input.required<Registration | null>();
  readonly refreshRequested = output<void>();
  private readonly attendance = inject(AttendanceApi);
  private readonly key = computed(() => {
    const r = this.registration();
    return `${this.event().id}:${r?.id ?? ''}:${r?.version ?? ''}:${r?.status ?? ''}`;
  });
  protected readonly state = linkedSignal<string, MyAttendance | null>({ source: this.key, computation: () => null });
  protected readonly loading = linkedSignal({ source: this.key, computation: () => this.registration()?.status === 'REGISTERED' });
  protected readonly error = linkedSignal({ source: this.key, computation: () => '' });
  private readonly now = signal(Date.now());
  private requestId = 0;
  private destroyed = false;

  private readonly status = computed(() => {
    const registration = this.registration();
    if (registration?.status !== 'REGISTERED') return registration?.status ?? null;
    const state = this.state();
    return state ? state.registrationStatus : registration.status;
  });
  protected readonly badge = computed(() => {
    switch (this.status()) {
      case 'REGISTERED': return ATTENDANCE_STATE_BADGE[this.state()?.attendanceState ?? 'NOT_RECORDED'];
      case 'WAITLISTED': return { label: 'Đang chờ suất', css: 'badge amber' };
      case 'CANCELLED': return { label: 'Đã hủy đăng ký', css: 'badge gray' };
      default: return { label: 'Chưa đăng ký', css: 'badge gray' };
    }
  });
  protected readonly present = computed(() => this.status() === 'REGISTERED' && this.state()?.attendanceState === 'PRESENT'
    ? this.state()?.attendance ?? null : null);
  protected readonly opensAt = computed(() => new Date(Date.parse(this.event().startsAt) - QR_OPENS_BEFORE_START_MS).toISOString());
  protected readonly beforeWindow = computed(() => this.status() === 'REGISTERED' && this.state()?.attendanceState === 'NOT_RECORDED'
    && this.now() < Date.parse(this.opensAt()));
  protected readonly canScan = computed(() => this.status() === 'REGISTERED' && this.state()?.attendanceState === 'NOT_RECORDED'
    && this.now() >= Date.parse(this.opensAt()) && this.now() < Date.parse(this.event().endsAt));
  protected readonly stamp = formatDateTime;
  protected readonly method = (value: keyof typeof METHOD_LABEL) => METHOD_LABEL[value];

  constructor() {
    effect(() => {
      this.key();
      untracked(() => void this.load());
    });
    // Refresh at the QR opening/end boundaries; the server still decides the attendance state.
    effect((onCleanup) => {
      const event = this.event();
      const now = this.now();
      if (this.registration()?.status !== 'REGISTERED') return;
      const next = [Date.parse(event.startsAt) - QR_OPENS_BEFORE_START_MS, Date.parse(event.endsAt)].find((at) => at > now);
      if (next === undefined) return;
      const timer = setTimeout(() => {
        this.now.set(Date.now());
        void this.load();
      }, Math.min(next - now + 100, 2_147_483_647));
      onCleanup(() => clearTimeout(timer));
    });
    inject(DestroyRef).onDestroy(() => { this.destroyed = true; this.requestId++; });
  }

  protected async load(): Promise<void> {
    const request = ++this.requestId;
    const key = this.key();
    const eventId = this.event().id;
    const current = () => !this.destroyed && request === this.requestId && key === this.key();
    this.state.set(null);
    this.error.set('');
    this.now.set(Date.now());
    this.loading.set(this.registration()?.status === 'REGISTERED');
    if (!this.loading()) return;
    try {
      const state = await this.attendance.mine(eventId);
      if (current()) this.state.set(state);
    } catch (error) {
      if (current()) this.error.set(errorMessage(error, 'Chưa tải được điểm danh.'));
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}
