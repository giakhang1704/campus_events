import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ApiError } from '../../core/api';
import { IconComponent } from '../../shared/icon/icon.component';
import { initials } from '../../shared/initials';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PagerComponent } from '../../shared/pager/pager.component';
import { ToastService } from '../../shared/toast/toast.service';
import { formatCountdown, formatDateTime, formatTime } from '../../shared/utils/date.utils';
import { errorMessage } from '../../shared/utils/error.utils';
import { formatCount } from '../../shared/utils/number.utils';
import { mergeQueryParams, pageFromQuery, pageToQuery } from '../../shared/utils/page-query.utils';
import { OwnedEventPicker, OwnedEventSelectComponent, OwnedEventStatesComponent } from '../events/owned-event-picker';
import { STATUS_BADGE } from '../registrations/registration.models';
import { AttendanceApi } from './attendance-api.service';
import {
  ATTENDANCE_FILTERS,
  ATTENDANCE_STATE_BADGE,
  AttendanceHistoryPage,
  AttendanceListPage,
  AttendanceResult,
  AttendanceRow,
  MANUAL_REASON_MAX,
  METHOD_LABEL,
  parseAttendanceFilter,
  QR_DURATIONS,
  QR_OPENS_BEFORE_START_MS,
  QrSession,
} from './attendance.models';

/** While a QR session is open the list refreshes on its own so new check-ins appear. */
const LIVE_REFRESH_MS = 10_000;
/** If the device clock runs ahead of the server, re-ask about an "expired" session at most this often. */
const EXPIRY_RECHECK_MS = 5_000;
/** setTimeout's upper limit (~24.8 days); later boundaries are re-planned when the timer fires. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** One display row: the API row plus values computed once per response. */
type Row = AttendanceRow & { initials: string; state: { label: string; css: string }; registrationBadge: { label: string; css: string }; recorded: string };

/** /attendance?event=<id>: QR session, live attendance list, manual changes and history (mockup `attendance()`, I3 màn B). */
@Component({
  selector: 'app-attendance',
  imports: [PageHeaderComponent, IconComponent, PagerComponent, OwnedEventSelectComponent, OwnedEventStatesComponent],
  providers: [OwnedEventPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Quản lý điểm danh">
      <app-owned-event-select />
    </app-page-header>

    <app-owned-event-states />
    @if (picker.selected(); as e) {
      @if (result()?.summary; as s) {
        <div class="stats">
          <div class="stat green"><div class="stat-top">Có mặt <app-icon name="check" /></div><strong>{{ count(s.presentCount) }}</strong><small>trên {{ count(s.registeredCount) }} đăng ký chính thức</small></div>
          <div class="stat"><div class="stat-top">Tỷ lệ tham dự <app-icon name="chart" /></div><strong>{{ s.attendanceRate === null ? '—' : s.attendanceRate + '%' }}</strong><small>{{ s.hasEnded ? 'Sau sự kiện' : 'Tạm tính' }}</small></div>
          @if (s.hasEnded) {
            <div class="stat amber"><div class="stat-top">Vắng <app-icon name="alert" /></div><strong>{{ count(s.absentCount ?? 0) }}</strong></div>
          } @else {
            <div class="stat amber"><div class="stat-top">Chưa ghi nhận <app-icon name="clock" /></div><strong>{{ count(s.notRecordedCount) }}</strong></div>
          }
          <div class="stat"><div class="stat-top">Danh sách chờ <app-icon name="users" /></div><strong>{{ count(s.waitingCount) }}</strong></div>
        </div>
      }

      <div class="split equal gap-bottom">
        <section class="panel" aria-labelledby="qr-heading">
          <div class="att-top">
            <div>
              <h3 id="qr-heading">Phiên điểm danh QR</h3>
              <p class="small-text muted">Mở được từ {{ qrOpensText() }} đến {{ stamp(e.endsAt) }}.</p>
            </div>
            <span [class]="sessionBadge().css">{{ sessionBadge().label }}</span>
          </div>

          @if (sessionLoading()) {
            <div class="sk sk-line" aria-hidden="true"></div>
          } @else if (session()?.active) {
            <p class="small-text muted gap-bottom">Sinh viên quét mã và xác nhận điểm danh.</p>
            <button type="button" class="block" [disabled]="sessionBusy()" (click)="closeSession()"><app-icon name="lock" /> {{ sessionBusy() ? 'Đang đóng…' : 'Đóng điểm danh' }}</button>
          } @else {
            @if (session(); as old) {
              <p class="small-text muted">Phiên trước {{ old.closedAt ? 'đã đóng lúc ' + time(old.closedAt) : 'đã hết hạn lúc ' + time(old.expiresAt) }}.</p>
            }
            @if (qrWindow() === 'BEFORE') {
              <div class="notice warn">Chưa đến giờ mở điểm danh.</div>
            } @else if (qrWindow() === 'ENDED') {
              <div class="notice warn">Sự kiện đã kết thúc. Có thể bổ sung điểm danh thủ công.</div>
            }
            <label class="duration">Thời hạn mã
              <select aria-label="Thời hạn mã" [disabled]="qrWindow() !== 'OPEN'" (change)="duration.set(+$any($event.target).value)">
                @for (d of durations; track d) { <option [value]="d" [selected]="d === duration()">{{ d }} phút</option> }
              </select>
            </label>
            <button type="button" class="primary block" [disabled]="sessionBusy() || qrWindow() !== 'OPEN'" (click)="openSession()">
              <app-icon name="qr" /> {{ sessionBusy() ? 'Đang mở…' : 'Mở điểm danh' }}
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
            <p class="qr-caption">{{ !session()?.active ? 'Chưa mở điểm danh' : sessionError() ? 'Chưa hiển thị được mã QR.' : 'Đang tải mã QR…' }}</p>
          }
        </section>
      </div>

      @if (manual(); as ed) {
        <section class="panel" aria-labelledby="manual-heading">
          <h2 id="manual-heading">{{ ed.result === 'PRESENT' ? 'Ghi nhận có mặt' : 'Bỏ ghi nhận có mặt' }}</h2>
          <p>{{ ed.row.fullName }} · {{ ed.row.studentCode }} · hiện tại: {{ ed.row.state.label }}</p>
          <label>Lý do
            <textarea aria-label="Lý do" [maxLength]="reasonMax" [value]="ed.reason" (input)="setReason($any($event.target).value)"
              placeholder="Ví dụ: Bổ sung từ danh sách ký tên dự phòng"></textarea>
            <small>Bắt buộc · Tối đa {{ reasonMax }} ký tự.</small>
          </label>
          @if (ed.error) { <p class="notice warn" role="alert">{{ ed.error }}</p> }
          <div class="actions">
            <button type="button" [disabled]="saving()" (click)="manual.set(null)">Hủy</button>
            <button type="button" class="primary" [disabled]="saving() || !ed.reason.trim()" (click)="saveManual()">{{ saving() ? 'Đang lưu…' : 'Lưu' }}</button>
          </div>
        </section>
      }

      @if (historyView(); as hv) {
        <section class="panel" aria-labelledby="history-heading">
          <div class="att-top">
            <div><h2 id="history-heading">Lịch sử điểm danh</h2><p class="small-text muted">{{ hv.row.fullName }} · {{ hv.row.studentCode }}</p></div>
            <button type="button" class="small" (click)="historyView.set(null)"><app-icon name="close" /> Đóng</button>
          </div>
          @if (hv.loading) {
            <div class="sk sk-line" aria-hidden="true"></div>
          } @else if (hv.error) {
            <p class="notice warn">{{ hv.error }}</p>
          } @else if (!hv.data?.items?.length) {
            <p class="muted">Chưa có thay đổi nào.</p>
          } @else {
            <div class="timeline">
              @for (h of hv.data!.items; track h.id) {
                <div class="step done">
                  <span class="step-icon">{{ h.newResult === 'PRESENT' ? '✓' : '–' }}</span>
                  <b>{{ resultLabel(h.oldResult) }} → {{ resultLabel(h.newResult) }}</b>
                  <small>{{ stamp(h.changedAt) }} · người thực hiện #{{ h.actorId }}</small>
                  <small>{{ h.reason }}</small>
                </div>
              }
            </div>
            <app-pager [page]="hv.data!.page" [hasNext]="hv.data!.hasNext" (pageChange)="loadHistory(hv.row, $event)" />
          }
        </section>
      }

      <div class="toolbar">
        <select class="role-select" aria-label="Lọc lượt đăng ký" (change)="setFilter($any($event.target).value)">
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
                            <button type="button" class="small" [disabled]="!manualOpen()" (click)="startManual(r, 'NOT_RECORDED')">Bỏ ghi nhận</button>
                          } @else {
                            <button type="button" class="small primary" [disabled]="!manualOpen()" (click)="startManual(r, 'PRESENT')">Ghi có mặt</button>
                          }
                        }
                        <button type="button" class="small" (click)="loadHistory(r, 0)">Lịch sử</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (!manualOpen()) {
            <p class="small-text muted gap-top">Ghi nhận thủ công mở từ {{ qrOpensText() }}.</p>
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

  protected readonly filters = ATTENDANCE_FILTERS;
  protected readonly durations = QR_DURATIONS;
  protected readonly skeleton = [1, 2, 3];
  protected readonly reasonMax = MANUAL_REASON_MAX;
  protected readonly pageToQuery = pageToQuery;
  protected readonly count = formatCount;
  protected readonly stamp = formatDateTime;
  protected readonly time = formatTime;
  protected readonly resultLabel = (r: AttendanceResult | null) => (r === 'PRESENT' ? 'Có mặt' : r ? 'Chưa ghi nhận' : 'Chưa có');

  /**
   * "Now" for the countdown and the QR window. It ticks every second only while a session is open;
   * otherwise it is refreshed once at the next window boundary (see the timer effect).
   */
  private readonly now = signal(Date.now());

  // ── URL state ──
  private readonly url = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => ({ filter: parseAttendanceFilter(q.get('status')), page: pageFromQuery(q) }))),
    { requireSync: true },
  );
  protected readonly filter = computed(() => this.url().filter);
  protected readonly page = computed(() => this.url().page);
  private readonly eventId = this.picker.selectedId;

  // ── QR session (reset when the event changes) ──
  protected readonly session = linkedSignal<number | null, QrSession | null>({ source: this.eventId, computation: () => null });
  protected readonly sessionError = linkedSignal({ source: this.eventId, computation: () => '' });
  protected readonly sessionLoading = signal(false);
  protected readonly sessionBusy = signal(false);
  protected readonly duration = signal(10);
  protected readonly qrUrl = signal<string | null>(null);
  /** Changes only when another session becomes active (or none is): the QR image is fetched once per session. */
  private readonly activeSession = computed(() => {
    const s = this.session();
    return s?.active ? { eventId: s.eventId, id: s.id } : null;
  }, { equal: (a, b) => a?.id === b?.id });

  private readonly qrOpensAtMs = computed(() => {
    const e = this.picker.selected();
    return e ? Date.parse(e.startsAt) - QR_OPENS_BEFORE_START_MS : 0;
  });
  protected readonly qrOpensText = computed(() => formatDateTime(new Date(this.qrOpensAtMs()).toISOString()));
  protected readonly qrWindow = computed<'BEFORE' | 'OPEN' | 'ENDED'>(() => {
    const e = this.picker.selected();
    if (!e || this.now() < this.qrOpensAtMs()) return 'BEFORE';
    return this.now() < Date.parse(e.endsAt) ? 'OPEN' : 'ENDED';
  });
  /** Manual recording opens with the QR window and stays open after the event ended. */
  protected readonly manualOpen = computed(() => this.qrWindow() !== 'BEFORE');
  /** Đang mở = active; Đã đóng = the last session was closed or expired; Chưa mở = no session yet. */
  protected readonly sessionBadge = computed(() => {
    const s = this.session();
    if (s?.active) return { label: 'Đang mở', css: 'badge blue' };
    return s ? { label: 'Đã đóng', css: 'badge gray' } : { label: 'Chưa mở', css: 'badge gray' };
  });
  protected readonly remaining = computed(() => formatCountdown(Date.parse(this.session()?.expiresAt ?? ''), this.now()));

  // ── Attendance list ──
  protected readonly result = signal<AttendanceListPage | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  private requestId = 0;
  private refreshing = false;
  protected readonly rows = computed<Row[]>(() =>
    (this.result()?.items ?? []).map((r) => ({
      ...r,
      initials: initials(r.fullName),
      state: ATTENDANCE_STATE_BADGE[r.attendanceState],
      registrationBadge: STATUS_BADGE[r.registrationStatus],
      recorded: r.method && r.recordedAt ? `${METHOD_LABEL[r.method]} · ${formatDateTime(r.recordedAt)}` : '',
    })),
  );

  // ── Manual change and history panels (one open at a time; both close when the event changes) ──
  protected readonly manual = linkedSignal<number | null, { row: Row; result: AttendanceResult; reason: string; error: string } | null>({
    source: this.eventId,
    computation: () => null,
  });
  protected readonly saving = signal(false);
  protected readonly historyView = linkedSignal<number | null, { row: Row; data: AttendanceHistoryPage | null; loading: boolean; error: string } | null>({
    source: this.eventId,
    computation: () => null,
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.setQrUrl(null));

    effect(() => {
      if (this.eventId()) untracked(() => void this.loadSession());
    });
    // List follows the event, filter and page.
    effect(() => {
      this.url();
      if (this.eventId()) untracked(() => void this.load());
    });
    effect(() => {
      const s = this.activeSession();
      untracked(() => void this.showQr(s));
    });
    // Timers. With an open session: 1 s clock (countdown, expiry) and the live list refresh.
    // Without: a single timeout at the next QR window boundary, so the buttons enable/disable on time.
    effect((onCleanup) => {
      const active = this.activeSession();
      const e = this.picker.selected();
      if (active) {
        let lastExpiryCheck = 0;
        const clock = setInterval(() => {
          const now = Date.now();
          this.now.set(now);
          const s = this.session();
          if (s?.active && now >= Date.parse(s.expiresAt) && now - lastExpiryCheck > EXPIRY_RECHECK_MS && !this.sessionLoading()) {
            lastExpiryCheck = now;
            void this.loadSession();
          }
        }, 1000);
        const live = setInterval(() => {
          if (document.visibilityState === 'visible') void this.load(true);
        }, LIVE_REFRESH_MS);
        onCleanup(() => {
          clearInterval(clock);
          clearInterval(live);
        });
      } else if (e) {
        const now = Date.now();
        untracked(() => this.now.set(now));
        const next = [this.qrOpensAtMs(), Date.parse(e.endsAt)].find((t) => t > now);
        if (next !== undefined) {
          const timer = setTimeout(() => this.now.set(Date.now()), Math.min(next - now + 50, MAX_TIMEOUT_MS));
          onCleanup(() => clearTimeout(timer));
        }
      }
    });
  }

  protected navigate(queryParams: Record<string, string | number | null>): void {
    mergeQueryParams(this.router, queryParams);
  }

  /** REGISTERED is the default, so it is left out of the URL. */
  protected setFilter(value: string): void {
    const filter = parseAttendanceFilter(value);
    this.navigate({ status: filter === 'REGISTERED' ? null : filter, page: null });
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
      this.sessionError.set(errorMessage(error));
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
      this.sessionError.set(errorMessage(error));
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
      // The session may still be open (or already closed elsewhere): show the server's state, never a guess.
      const message = errorMessage(error);
      this.toast.error('Đóng điểm danh chưa thành công. Đã tải lại trạng thái phiên từ máy chủ.');
      await this.loadSession();
      this.sessionError.set(`Đóng điểm danh chưa thành công: ${message}`);
    } finally {
      this.sessionBusy.set(false);
    }
  }

  private async showQr(active: { eventId: number; id: number } | null): Promise<void> {
    if (!active) return this.setQrUrl(null);
    try {
      const svg = await this.attendance.qrSvg(active.eventId, active.id);
      // Ignore the image if another session became active while it was loading.
      if (this.activeSession()?.id === active.id) this.setQrUrl(URL.createObjectURL(svg));
    } catch (error) {
      this.setQrUrl(null);
      this.sessionError.set(errorMessage(error));
    }
  }

  private setQrUrl(url: string | null): void {
    const old = this.qrUrl();
    if (old) URL.revokeObjectURL(old);
    this.qrUrl.set(url);
  }

  // ── List ──

  /** quiet: background refresh; keeps the table on screen, ignores errors and never overlaps another refresh. */
  async load(quiet = false): Promise<void> {
    const eventId = this.eventId();
    if (!eventId || (quiet && this.refreshing)) return;
    const id = ++this.requestId;
    if (quiet) this.refreshing = true;
    else {
      this.loading.set(true);
      this.error.set('');
    }
    try {
      const result = await this.attendance.list(eventId, this.filter(), this.page());
      if (id === this.requestId) this.result.set(result);
    } catch (error) {
      if (id === this.requestId && !quiet) {
        this.result.set(null);
        this.error.set(errorMessage(error));
      }
    } finally {
      if (quiet) this.refreshing = false;
      if (id === this.requestId) this.loading.set(false);
    }
  }

  // ── Manual change ──

  protected startManual(row: Row, result: AttendanceResult): void {
    this.historyView.set(null);
    this.manual.set({ row, result, reason: '', error: '' });
  }

  protected setReason(reason: string): void {
    this.manual.update((m) => m && { ...m, reason });
  }

  protected async saveManual(): Promise<void> {
    const m = this.manual();
    const eventId = this.eventId();
    const reason = m?.reason.trim();
    if (!m || !eventId || !reason || this.saving()) return;
    this.saving.set(true);
    try {
      await this.attendance.setManual(eventId, m.row.registrationId, {
        result: m.result,
        version: m.row.attendanceVersion,
        registrationVersion: m.row.registrationVersion,
        reason,
      });
      this.manual.set(null);
      this.toast.success(m.result === 'PRESENT' ? `Đã ghi nhận ${m.row.fullName} có mặt.` : `Đã bỏ ghi nhận của ${m.row.fullName}.`);
      await this.load(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
        // Never overwrite a newer result: reload and let the organizer decide again.
        this.manual.set(null);
        this.toast.error('Kết quả của sinh viên này vừa thay đổi (ví dụ vừa quét QR). Danh sách đã được tải lại, hãy kiểm tra rồi thao tác lại.');
        await this.load(true);
      } else {
        this.manual.update((current) => current && { ...current, error: errorMessage(error) });
      }
    } finally {
      this.saving.set(false);
    }
  }

  // ── History ──

  async loadHistory(row: Row, page: number): Promise<void> {
    const eventId = this.eventId();
    if (!eventId) return;
    this.manual.set(null);
    this.historyView.update((h) => ({ row, data: h?.row.registrationId === row.registrationId ? h.data : null, loading: true, error: '' }));
    try {
      const data = await this.attendance.history(eventId, row.registrationId, page);
      this.historyView.update((h) => (h?.row.registrationId === row.registrationId ? { ...h, data, loading: false } : h));
    } catch (error) {
      this.historyView.update((h) => (h?.row.registrationId === row.registrationId ? { ...h, loading: false, error: errorMessage(error) } : h));
    }
  }
}
