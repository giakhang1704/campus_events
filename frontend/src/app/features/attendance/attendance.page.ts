import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ApiError } from '../../core/api';
import { IconComponent } from '../../shared/icon/icon.component';
import { initials } from '../../shared/initials';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PagerComponent } from '../../shared/pager/pager.component';
import { ToastService } from '../../shared/toast/toast.service';
import { formatDateTime, formatTime } from '../../shared/utils/date.utils';
import { formatCount } from '../../shared/utils/number.utils';
import { pageFromQuery, pageToQuery } from '../../shared/utils/page-query.utils';
import { OwnedEventPicker, OwnedEventSelectComponent, OwnedEventStatesComponent } from '../events/owned-event-picker';
import { STATUS_BADGE } from '../registrations/registration.models';
import { AttendanceApi } from './attendance-api.service';
import {
  ATTENDANCE_STATE_BADGE,
  AttendanceFilter,
  AttendanceHistoryPage,
  AttendanceListPage,
  AttendanceResult,
  AttendanceRow,
  MANUAL_REASON_MAX,
  METHOD_LABEL,
  QR_OPENS_BEFORE_START_MS,
  QrSession,
} from './attendance.models';

const FILTERS: { value: AttendanceFilter; label: string }[] = [
  { value: 'REGISTERED', label: 'Đăng ký chính thức' },
  { value: 'ALL', label: 'Tất cả lượt đăng ký' },
  { value: 'WAITLISTED', label: 'Danh sách chờ' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];
const DURATIONS = [5, 10, 15, 30];
/** While a QR session is open the list refreshes on its own so new check-ins appear. */
const LIVE_REFRESH_MS = 10_000;

function parseFilter(value: string | null): AttendanceFilter {
  return value === 'ALL' || value === 'WAITLISTED' || value === 'CANCELLED' ? value : 'REGISTERED';
}

/** "04:59" until the given moment. */
function countdown(untilMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.ceil((untilMs - nowMs) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** /attendance?event=<id>: QR session, live attendance list, manual changes and history (mockup `attendance()`, I3 màn B). */
@Component({
  selector: 'app-attendance',
  imports: [PageHeaderComponent, IconComponent, PagerComponent, OwnedEventSelectComponent, OwnedEventStatesComponent],
  providers: [OwnedEventPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Quản lý điểm danh" subtitle="Mở QR cho sinh viên quét và bổ sung kết quả khi cần.">
      <app-owned-event-select />
    </app-page-header>

    <app-owned-event-states />
    @if (picker.selected(); as e) {
      @if (result()?.summary; as s) {
        <div class="stats">
          <div class="stat green"><div class="stat-top">Có mặt <app-icon name="check" /></div><strong>{{ count(s.presentCount) }}</strong><small>trên {{ count(s.registeredCount) }} đăng ký chính thức</small></div>
          <div class="stat"><div class="stat-top">Tỷ lệ tham dự <app-icon name="chart" /></div><strong>{{ s.attendanceRate === null ? '—' : s.attendanceRate + '%' }}</strong><small>{{ s.hasEnded ? 'kết quả cuối' : 'số liệu tạm thời' }}</small></div>
          @if (s.hasEnded) {
            <div class="stat amber"><div class="stat-top">Vắng <app-icon name="alert" /></div><strong>{{ count(s.absentCount ?? 0) }}</strong><small>không được ghi nhận</small></div>
          } @else {
            <div class="stat amber"><div class="stat-top">Chưa ghi nhận <app-icon name="clock" /></div><strong>{{ count(s.notRecordedCount) }}</strong><small>chưa có mặt</small></div>
          }
          <div class="stat"><div class="stat-top">Danh sách chờ <app-icon name="users" /></div><strong>{{ count(s.waitingCount) }}</strong><small>không tính vào tỷ lệ</small></div>
        </div>
      }

      <div class="split equal gap-bottom">
        <section class="panel" aria-labelledby="qr-heading">
          <div class="att-top">
            <div>
              <h3 id="qr-heading">Phiên điểm danh QR</h3>
              <p class="small-text muted">Mở được từ {{ stamp(qrOpensAt()) }} đến {{ stamp(e.endsAt) }}.</p>
            </div>
            <span [class]="sessionBadge().css">{{ sessionBadge().label }}</span>
          </div>

          @if (sessionLoading()) {
            <div class="sk sk-line" aria-hidden="true"></div>
          } @else if (session()?.active) {
            <div class="notice">Sinh viên quét mã bên cạnh rồi bấm Xác nhận trên điện thoại. Mở lại khi phiên còn hiệu lực sẽ giữ nguyên mã, không gia hạn.</div>
            <button type="button" class="block" [disabled]="sessionBusy()" (click)="closeSession()"><app-icon name="lock" /> Đóng phiên</button>
          } @else {
            @if (session(); as old) {
              <p class="small-text muted">Phiên trước {{ old.closedAt ? 'đã đóng lúc ' + time(old.closedAt) : 'đã hết hạn lúc ' + time(old.expiresAt) }}. Mở phiên mới sẽ tạo mã mới.</p>
            }
            @if (qrWindow() === 'BEFORE') {
              <div class="notice warn">Chưa đến giờ mở QR (từ 30 phút trước khi sự kiện bắt đầu).</div>
            } @else if (qrWindow() === 'ENDED') {
              <div class="notice warn">Sự kiện đã kết thúc; không mở QR được nữa. Vẫn ghi nhận thủ công được ở danh sách bên dưới.</div>
            }
            <label class="duration">Thời hạn mã
              <select aria-label="Thời hạn mã" [disabled]="qrWindow() !== 'OPEN'" (change)="duration.set(+$any($event.target).value)">
                @for (d of durations; track d) { <option [value]="d" [selected]="d === duration()">{{ d }} phút</option> }
              </select>
            </label>
            <button type="button" class="primary block" [disabled]="sessionBusy() || qrWindow() !== 'OPEN'" (click)="openSession()">
              <app-icon name="qr" /> {{ sessionBusy() ? 'Đang mở…' : 'Mở phiên QR' }}
            </button>
          }
          @if (sessionError(); as err) {
            <div class="notice warn" role="alert">{{ err }} <button type="button" class="small" (click)="loadSession()">Thử lại</button></div>
          }
        </section>

        <section class="qr-panel" aria-live="polite">
          @if (session()?.active && qrUrl(); as url) {
            <h3>{{ e.title }}</h3>
            <div class="qr-wrap qr-large"><img [src]="url" alt="Mã QR điểm danh" /></div>
            <p class="qr-caption">Hết hạn lúc {{ time(session()!.expiresAt) }} · còn <b>{{ remaining() }}</b></p>
          } @else {
            <div class="qr-empty"><app-icon name="qr" /></div>
            <p class="qr-caption">{{ session()?.active ? 'Đang tải mã QR…' : 'Mã QR hiện ở đây khi phiên được mở.' }}</p>
          }
        </section>
      </div>

      @if (editing(); as ed) {
        <section class="panel" aria-labelledby="manual-heading">
          <h2 id="manual-heading">{{ ed.result === 'PRESENT' ? 'Ghi nhận có mặt' : 'Bỏ ghi nhận có mặt' }}</h2>
          <p>{{ ed.row.fullName }} · {{ ed.row.studentCode }} · hiện tại: {{ stateBadge(ed.row).label }}</p>
          <label>Lý do
            <textarea aria-label="Lý do" [maxLength]="reasonMax" [value]="reason()" (input)="reason.set($any($event.target).value)"
              placeholder="Ví dụ: Bổ sung từ danh sách ký tên dự phòng"></textarea>
            <small>Bắt buộc, tối đa {{ reasonMax }} ký tự. Được lưu vào lịch sử điểm danh.</small>
          </label>
          @if (formError(); as err) { <p class="notice warn" role="alert">{{ err }}</p> }
          <div class="actions">
            <button type="button" [disabled]="saving()" (click)="editing.set(null)">Hủy</button>
            <button type="button" class="primary" [disabled]="saving() || !reason().trim()" (click)="saveManual()">{{ saving() ? 'Đang lưu…' : 'Lưu' }}</button>
          </div>
        </section>
      }

      @if (historyFor(); as row) {
        <section class="panel" aria-labelledby="history-heading">
          <div class="att-top">
            <div><h2 id="history-heading">Lịch sử điểm danh</h2><p class="small-text muted">{{ row.fullName }} · {{ row.studentCode }}</p></div>
            <button type="button" class="small" (click)="historyFor.set(null)"><app-icon name="close" /> Đóng</button>
          </div>
          @if (historyLoading()) {
            <div class="sk sk-line" aria-hidden="true"></div>
          } @else if (historyError(); as err) {
            <p class="notice warn">{{ err }}</p>
          } @else if (!history()?.items?.length) {
            <p class="muted">Chưa có thay đổi nào.</p>
          } @else {
            <div class="timeline">
              @for (h of history()!.items; track h.id) {
                <div class="step done">
                  <span class="step-icon">{{ h.newResult === 'PRESENT' ? '✓' : '–' }}</span>
                  <b>{{ resultLabel(h.oldResult) }} → {{ resultLabel(h.newResult) }}</b>
                  <small>{{ stamp(h.changedAt) }} · người thực hiện #{{ h.actorId }}</small>
                  <small>{{ h.reason }}</small>
                </div>
              }
            </div>
            <app-pager [page]="historyPage()" [hasNext]="history()!.hasNext" (pageChange)="loadHistory(row, $event)" />
          }
        </section>
      }

      <div class="toolbar">
        <select class="role-select" aria-label="Lọc lượt đăng ký" (change)="navigate({ status: $any($event.target).value === 'REGISTERED' ? null : $any($event.target).value, page: null })">
          @for (f of filters; track f.value) { <option [value]="f.value" [selected]="f.value === filter()">{{ f.label }}</option> }
        </select>
        <button type="button" class="small" [disabled]="loading()" (click)="load()">Tải lại</button>
      </div>
      <section class="panel" [attr.aria-busy]="loading()">
        @if (loading() && !result()) {
          <span class="sr-only" role="status">Đang tải danh sách điểm danh…</span>
          <div class="skeleton-list" aria-hidden="true">
            @for (n of skeleton; track n) { <div class="skeleton-row"><span class="sk sk-title"></span><span class="sk sk-badge"></span><span class="sk sk-date"></span></div> }
          </div>
        } @else if (error()) {
          <div class="empty">
            <app-icon name="info" />
            <h3>Chưa tải được danh sách điểm danh</h3>
            <p>{{ error() }}</p>
            <button type="button" class="primary" (click)="load()">Thử lại</button>
          </div>
        } @else if (!rows().length) {
          <div class="empty">
            <app-icon name="users" />
            <h3>{{ filter() === 'REGISTERED' ? 'Chưa có sinh viên đăng ký chính thức' : 'Không có lượt đăng ký phù hợp' }}</h3>
            <p>Danh sách cập nhật khi sinh viên đăng ký hoặc quét QR.</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table>
              <thead><tr><th>Sinh viên</th><th>MSSV</th><th>Khoa · Năm</th><th>Điểm danh</th><th><span class="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                @for (r of rows(); track r.registrationId) {
                  <tr>
                    <td>
                      <div class="person-cell">
                        <span class="avatar">{{ r.initials }}</span>
                        <div><strong>{{ r.fullName }}</strong><small>{{ r.email }}</small></div>
                      </div>
                    </td>
                    <td class="nowrap">{{ r.studentCode }}</td>
                    <td>{{ r.department }}<small>Năm {{ r.studyYear }}</small></td>
                    <td>
                      @if (r.registrationStatus !== 'REGISTERED') { <span [class]="r.registrationBadge.css">{{ r.registrationBadge.label }}</span> }
                      <span [class]="r.state.css">{{ r.state.label }}</span>
                      @if (r.recorded) { <small>{{ r.recorded }}</small> }
                    </td>
                    <td>
                      <div class="row-actions">
                        @if (r.registrationStatus === 'REGISTERED') {
                          @if (r.result === 'PRESENT') {
                            <button type="button" class="small" [disabled]="!manualOpen()" (click)="startManual(r.source, 'NOT_RECORDED')">Bỏ ghi nhận</button>
                          } @else {
                            <button type="button" class="small primary" [disabled]="!manualOpen()" (click)="startManual(r.source, 'PRESENT')">Ghi có mặt</button>
                          }
                        }
                        <button type="button" class="small" (click)="loadHistory(r.source, 0)">Lịch sử</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (!manualOpen()) {
            <p class="small-text muted gap-top">Ghi nhận thủ công mở từ {{ stamp(qrOpensAt()) }}.</p>
          }
        }
        @if (!error()) {
          <app-pager [page]="page()" [hasNext]="result()?.hasNext ?? false" [disabled]="loading()" (pageChange)="navigate({ page: pageToQuery($event) })" />
        }
      </section>
    }
  `,
  styles: `
    .duration { margin: 12px 0; }
    .qr-panel h3 { overflow-wrap: anywhere; }
    .qr-large { width: min(280px, 100%); height: auto; aspect-ratio: 1; }
    .qr-large img { width: 100%; height: 100%; display: block; }
    td small { display: block; }
    td .badge + .badge { margin-left: 6px; }
  `,
})
export class AttendancePage {
  private readonly attendance = inject(AttendanceApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly picker = inject(OwnedEventPicker);

  protected readonly filters = FILTERS;
  protected readonly durations = DURATIONS;
  protected readonly skeleton = [1, 2, 3];
  protected readonly reasonMax = MANUAL_REASON_MAX;
  protected readonly pageToQuery = pageToQuery;
  protected readonly count = formatCount;
  protected readonly stamp = formatDateTime;
  protected readonly time = formatTime;
  protected readonly resultLabel = (r: AttendanceResult | null) => (r === 'PRESENT' ? 'Có mặt' : r ? 'Chưa ghi nhận' : 'Chưa có');
  protected readonly stateBadge = (r: AttendanceRow) => ATTENDANCE_STATE_BADGE[r.attendanceState];

  /** Ticks every second: countdown, QR window and expiry. */
  private readonly now = signal(Date.now());

  // ── URL state ──
  private readonly url = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => ({ filter: parseFilter(q.get('status')), page: pageFromQuery(q) }))),
    { requireSync: true },
  );
  protected readonly filter = computed(() => this.url().filter);
  protected readonly page = computed(() => this.url().page);
  private readonly eventId = computed(() => this.picker.selected()?.id ?? null);

  // ── QR session ──
  protected readonly session = signal<QrSession | null>(null);
  protected readonly sessionLoading = signal(false);
  protected readonly sessionBusy = signal(false);
  protected readonly sessionError = signal('');
  protected readonly duration = signal(10);
  protected readonly qrUrl = signal<string | null>(null);

  protected readonly qrOpensAt = computed(() => {
    const e = this.picker.selected();
    return e ? new Date(Date.parse(e.startsAt) - QR_OPENS_BEFORE_START_MS).toISOString() : new Date().toISOString();
  });
  protected readonly qrWindow = computed<'BEFORE' | 'OPEN' | 'ENDED'>(() => {
    const e = this.picker.selected();
    if (!e) return 'BEFORE';
    if (this.now() < Date.parse(this.qrOpensAt())) return 'BEFORE';
    return this.now() < Date.parse(e.endsAt) ? 'OPEN' : 'ENDED';
  });
  /** Manual recording opens with the QR window and stays open after the event ended. */
  protected readonly manualOpen = computed(() => this.qrWindow() !== 'BEFORE');
  protected readonly remaining = computed(() => countdown(Date.parse(this.session()?.expiresAt ?? ''), this.now()));
  protected readonly sessionBadge = computed(() =>
    this.session()?.active ? { label: 'Đang mở', css: 'badge blue' } : { label: 'Chưa mở', css: 'badge gray' },
  );

  // ── Attendance list ──
  protected readonly result = signal<AttendanceListPage | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  private requestId = 0;
  /** Display values per row, computed once per response. */
  protected readonly rows = computed(() =>
    (this.result()?.items ?? []).map((r) => ({
      ...r,
      source: r,
      initials: initials(r.fullName),
      state: ATTENDANCE_STATE_BADGE[r.attendanceState],
      registrationBadge: STATUS_BADGE[r.registrationStatus],
      recorded: r.method && r.recordedAt ? `${METHOD_LABEL[r.method]} · ${formatDateTime(r.recordedAt)}` : '',
    })),
  );

  // ── Manual change ──
  protected readonly editing = signal<{ row: AttendanceRow; result: AttendanceResult } | null>(null);
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly formError = signal('');

  // ── History ──
  protected readonly historyFor = signal<AttendanceRow | null>(null);
  protected readonly history = signal<AttendanceHistoryPage | null>(null);
  protected readonly historyPage = signal(0);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 1000);
    const live = setInterval(() => {
      if (this.session()?.active && document.visibilityState === 'visible') void this.load(true);
    }, LIVE_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(clock);
      clearInterval(live);
      this.setQrUrl(null);
    });

    // New event: its session, and close panels that belong to the previous one.
    effect(() => {
      const id = this.eventId();
      untracked(() => {
        this.editing.set(null);
        this.historyFor.set(null);
        this.session.set(null);
        this.sessionError.set('');
        if (id) void this.loadSession();
      });
    });
    // List follows the event, filter and page.
    effect(() => {
      this.url();
      if (this.eventId()) untracked(() => void this.load());
    });
    // The QR image follows the active session.
    effect(() => {
      const s = this.session();
      untracked(() => void this.showQr(s));
    });
    // When the session runs out, ask the server (at most every 5 s, in case the device clock runs ahead);
    // the page then offers a new session.
    let lastExpiryCheck = 0;
    effect(() => {
      const s = this.session();
      const now = this.now();
      if (s?.active && now >= Date.parse(s.expiresAt) && now - lastExpiryCheck > 5000 && !untracked(() => this.sessionLoading())) {
        lastExpiryCheck = now;
        untracked(() => void this.loadSession());
      }
    });
  }

  protected navigate(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }

  // ── QR session ──

  async loadSession(): Promise<void> {
    const eventId = this.eventId();
    if (!eventId) return;
    this.sessionLoading.set(true);
    this.sessionError.set('');
    try {
      const s = await this.attendance.currentSession(eventId);
      if (eventId === this.eventId()) this.session.set(s);
    } catch (error) {
      this.sessionError.set(message(error));
    } finally {
      this.sessionLoading.set(false);
    }
  }

  protected async openSession(): Promise<void> {
    const eventId = this.eventId();
    if (!eventId || this.sessionBusy()) return;
    this.sessionBusy.set(true);
    this.sessionError.set('');
    try {
      this.session.set(await this.attendance.openSession(eventId, this.duration()));
    } catch (error) {
      this.sessionError.set(message(error));
    } finally {
      this.sessionBusy.set(false);
    }
  }

  protected async closeSession(): Promise<void> {
    const eventId = this.eventId();
    const s = this.session();
    if (!eventId || !s || this.sessionBusy()) return;
    this.sessionBusy.set(true);
    try {
      this.session.set(await this.attendance.closeSession(eventId, s.id));
      this.toast.success('Đã đóng phiên QR. Mã cũ không còn dùng được.');
    } catch (error) {
      this.sessionError.set(message(error));
    } finally {
      this.sessionBusy.set(false);
    }
  }

  private async showQr(s: QrSession | null): Promise<void> {
    if (!s?.active) return this.setQrUrl(null);
    try {
      const svg = await this.attendance.qrSvg(s.eventId, s.id);
      // Ignore the image if the session changed while it was loading.
      if (this.session()?.id === s.id && this.session()?.active) this.setQrUrl(URL.createObjectURL(svg));
    } catch (error) {
      this.setQrUrl(null);
      this.sessionError.set(message(error));
    }
  }

  private setQrUrl(url: string | null): void {
    const old = this.qrUrl();
    if (old) URL.revokeObjectURL(old);
    this.qrUrl.set(url);
  }

  // ── List ──

  /** quiet: background refresh, keeps the table on screen and ignores errors. */
  async load(quiet = false): Promise<void> {
    const eventId = this.eventId();
    if (!eventId) return;
    const id = ++this.requestId;
    if (!quiet) {
      this.loading.set(true);
      this.error.set('');
    }
    try {
      const result = await this.attendance.list(eventId, this.filter(), this.page());
      if (id === this.requestId) this.result.set(result);
    } catch (error) {
      if (id === this.requestId && !quiet) {
        this.result.set(null);
        this.error.set(message(error));
      }
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }

  // ── Manual change ──

  protected startManual(row: AttendanceRow, result: AttendanceResult): void {
    this.historyFor.set(null);
    this.reason.set('');
    this.formError.set('');
    this.editing.set({ row, result });
  }

  protected async saveManual(): Promise<void> {
    const ed = this.editing();
    const eventId = this.eventId();
    const reason = this.reason().trim();
    if (!ed || !eventId || !reason || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      await this.attendance.setManual(eventId, ed.row.registrationId, {
        result: ed.result,
        version: ed.row.attendanceVersion,
        registrationVersion: ed.row.registrationVersion,
        reason,
      });
      this.editing.set(null);
      this.toast.success(ed.result === 'PRESENT' ? `Đã ghi nhận ${ed.row.fullName} có mặt.` : `Đã bỏ ghi nhận của ${ed.row.fullName}.`);
      await this.load(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
        // Never overwrite a newer result: reload and let the organizer decide again.
        this.editing.set(null);
        this.toast.error('Kết quả của sinh viên này vừa thay đổi (ví dụ vừa quét QR). Danh sách đã được tải lại, hãy kiểm tra rồi thao tác lại.');
        await this.load(true);
      } else {
        this.formError.set(message(error));
      }
    } finally {
      this.saving.set(false);
    }
  }

  // ── History ──

  async loadHistory(row: AttendanceRow, page: number): Promise<void> {
    const eventId = this.eventId();
    if (!eventId) return;
    this.editing.set(null);
    this.historyFor.set(row);
    this.historyPage.set(page);
    this.historyLoading.set(true);
    this.historyError.set('');
    try {
      const result = await this.attendance.history(eventId, row.registrationId, page);
      if (this.historyFor()?.registrationId === row.registrationId) this.history.set(result);
    } catch (error) {
      this.historyError.set(message(error));
    } finally {
      this.historyLoading.set(false);
    }
  }
}

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Không thực hiện được. Vui lòng thử lại.';
}
