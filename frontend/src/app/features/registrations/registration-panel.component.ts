import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { ApiError } from '../../core/api';
import { IconComponent } from '../../shared/icon/icon.component';
import { ToastService } from '../../shared/toast/toast.service';
import { formatDateTime } from '../../shared/utils/date.utils';
import { formatCount } from '../../shared/utils/number.utils';
import { CampusEvent } from '../events/event.models';
import { RegistrationApi } from './registration-api.service';
import { RegistrationState, STATUS_BADGE, statusSince } from './registration.models';

/**
 * Student call-to-action on /events/:id (mockup `detail()` CTA): register, join the waitlist, cancel.
 * The server decides everything (window, eligibility, seats); this panel only reflects GET .../registration.
 */
@Component({
  selector: 'app-registration-panel',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <span class="sr-only" role="status">Đang tải trạng thái đăng ký…</span>
      <div class="sk sk-line gap-top" aria-hidden="true"></div>
      <div class="sk sk-button gap-top" aria-hidden="true"></div>
    } @else if (loadError()) {
      <div class="notice warn" role="alert">
        Chưa tải được trạng thái đăng ký. <button type="button" class="small" (click)="reload()">Thử lại</button>
      </div>
    } @else if (state(); as s) {
      <div class="info-row"><span>Còn trống</span><b>{{ seats() }}</b></div>

      @if (active(); as r) {
        <div class="reg-status gap-top">
          <span [class]="badge(r.status).css">{{ badge(r.status).label }}</span>
          <small class="muted">từ {{ stamp(since(r)) }}</small>
        </div>
        @if (r.status === 'WAITLISTED') {
          <div class="notice warn">
            Bạn đang ở vị trí <b>#{{ r.queuePosition ?? '?' }}</b> trong danh sách chờ.
            Khi có chỗ trước giờ bắt đầu, hệ thống tự chuyển bạn lên và gửi email thông báo.
          </div>
        } @else {
          <div class="notice success">Bạn đã có chỗ tham gia sự kiện. Email xác nhận được gửi tới hộp thư của bạn.</div>
        }

        @if (confirming()) {
          <div class="confirm-box" role="group" aria-label="Xác nhận hủy">
            <p>{{ r.status === 'WAITLISTED' ? 'Rời danh sách chờ? Nếu đăng ký lại, bạn sẽ xếp cuối hàng chờ.' : 'Hủy đăng ký? Chỗ của bạn sẽ được chuyển cho người đang chờ.' }}</p>
            <div class="actions">
              <button type="button" class="small" [disabled]="busy()" (click)="confirming.set(false)">Giữ lại</button>
              <button type="button" class="small danger" [disabled]="busy()" (click)="cancel()">
                {{ busy() ? 'Đang hủy…' : 'Xác nhận hủy' }}
              </button>
            </div>
          </div>
        } @else {
          <button type="button" class="block gap-top" [disabled]="busy() || started()" (click)="confirming.set(true)">
            {{ r.status === 'WAITLISTED' ? 'Rời danh sách chờ' : 'Hủy đăng ký' }}
          </button>
          @if (started()) {
            <p class="muted small-text gap-top">Sự kiện đã bắt đầu nên không thể hủy.</p>
          }
        }
      } @else {
        @if (!s.eligible) {
          <div class="notice warn">Bạn không thuộc khoa/năm học được tham gia sự kiện này.</div>
        } @else if (s.registration?.status === 'CANCELLED') {
          <p class="muted small-text gap-top">Bạn đã hủy đăng ký lúc {{ stamp(s.registration!.cancelledAt) }}.</p>
        }
        <button type="button" class="primary block gap-top" [disabled]="!canRegister() || busy()" (click)="register()">
          {{ busy() ? 'Đang gửi…' : ctaLabel() }} @if (!busy()) { <app-icon name="arrow" /> }
        </button>
        @if (hint(); as h) {
          <p class="muted small-text gap-top">{{ h }}</p>
        }
      }
    }
  `,
  styles: `
    .reg-status { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .confirm-box { margin-top: 18px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: #fafbfd; }
    .confirm-box p { font-size: 13px; margin-bottom: 12px; }
    .confirm-box .actions { justify-content: flex-end; }
    .sk-button { height: 44px; border-radius: 10px; }
  `,
})
export class RegistrationPanelComponent {
  readonly event = input.required<CampusEvent>();

  private readonly registrations = inject(RegistrationApi);
  private readonly toast = inject(ToastService);

  protected readonly state = signal<RegistrationState | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);
  private requestId = 0;

  protected readonly stamp = (iso: string | null) => (iso ? formatDateTime(iso) : '—');
  protected readonly badge = (status: keyof typeof STATUS_BADGE) => STATUS_BADGE[status];
  protected readonly since = statusSince;
  /** The id alone: a new event object with the same id (parent reload) must not refetch the state. */
  private readonly eventId = computed(() => this.event().id);

  /** REGISTERED or WAITLISTED; a CANCELLED row counts as "not registered". */
  protected readonly active = computed(() => {
    const r = this.state()?.registration;
    return r && r.status !== 'CANCELLED' ? r : null;
  });
  protected readonly started = computed(() => Date.now() >= Date.parse(this.event().startsAt));
  protected readonly canRegister = computed(() => {
    const s = this.state();
    return !!s && s.eligible && s.registrationOpen && !this.started();
  });
  protected readonly seats = computed(() => {
    const s = this.state()!;
    const waiting = s.waitingCount ? ` · ${formatCount(s.waitingCount)} người chờ` : '';
    return `${formatCount(s.availableSeats)} / ${formatCount(this.event().capacity)} chỗ${waiting}`;
  });
  protected readonly ctaLabel = computed(() => {
    const s = this.state()!;
    if (this.started()) return 'Sự kiện đã bắt đầu';
    if (!s.eligible) return 'Không thuộc đối tượng tham gia';
    if (!s.registrationOpen) return 'Ngoài thời gian đăng ký';
    if (s.availableSeats <= 0) return 'Tham gia danh sách chờ';
    return s.registration?.status === 'CANCELLED' ? 'Đăng ký lại' : 'Đăng ký tham gia';
  });
  protected readonly hint = computed(() => {
    const s = this.state()!;
    const e = this.event();
    if (!s.eligible || this.started()) return '';
    if (!s.registrationOpen) {
      return Date.now() < Date.parse(e.registrationOpensAt)
        ? `Mở nhận đăng ký lúc ${formatDateTime(e.registrationOpensAt)}.`
        : 'Đã hết thời gian nhận đăng ký.';
    }
    return s.availableSeats <= 0 ? 'Sự kiện đã đủ chỗ. Bạn sẽ được xếp vào danh sách chờ theo thứ tự đăng ký.' : '';
  });

  constructor() {
    effect(() => void this.load(this.eventId()));
  }

  protected reload(): void {
    void this.load(this.eventId());
  }

  private async load(eventId: number, quiet = false): Promise<void> {
    const id = ++this.requestId;
    if (!quiet) this.loading.set(true);
    this.loadError.set(false);
    try {
      const state = await this.registrations.state(eventId);
      if (id === this.requestId) this.state.set(state);
    } catch {
      if (id === this.requestId && !quiet) this.loadError.set(true);
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }

  protected async register(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const r = await this.registrations.register(this.eventId());
      this.toast.success(
        r.status === 'REGISTERED'
          ? 'Đăng ký thành công. Email xác nhận sẽ được gửi tới bạn.'
          : `Sự kiện đã đủ chỗ. Bạn ở vị trí #${r.queuePosition ?? '?'} trong danh sách chờ.`,
      );
    } catch (error) {
      this.toast.error(this.describe(error));
    } finally {
      await this.load(this.eventId(), true);
      this.busy.set(false);
    }
  }

  protected async cancel(): Promise<void> {
    const r = this.active();
    if (!r || this.busy()) return;
    this.busy.set(true);
    try {
      await this.registrations.cancel(this.eventId(), r.version);
      this.toast.success(r.status === 'WAITLISTED' ? 'Đã rời danh sách chờ.' : 'Đã hủy đăng ký.');
    } catch (error) {
      this.toast.error(
        error instanceof ApiError && error.code === 'VERSION_CONFLICT'
          ? 'Trạng thái đăng ký vừa thay đổi (ví dụ bạn vừa được chuyển lên từ danh sách chờ). Hãy xem lại rồi thử lại.'
          : this.describe(error),
      );
    } finally {
      this.confirming.set(false);
      await this.load(this.eventId(), true);
      this.busy.set(false);
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'Không thực hiện được. Vui lòng thử lại.';
  }
}
