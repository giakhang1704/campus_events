import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { ApiError } from '../../core/api';
import { IconComponent } from '../../shared/icon/icon.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { formatDateTime, formatLongDate, formatTime, formatTimeRange } from '../../shared/utils/date.utils';
import { errorMessage } from '../../shared/utils/error.utils';
import { AttendanceApi } from '../attendance/attendance-api.service';
import { Attendance, AttendancePreview, CheckInQr, CheckInRequest, METHOD_LABEL, parseCheckInQr } from '../attendance/attendance.models';
import { RegistrationApi } from '../registrations/registration-api.service';
import { Registration } from '../registrations/registration.models';

/** Why the camera could not start; each kind has its own instructions in the template. */
type CameraProblem = 'DENIED' | 'NO_CAMERA' | 'BUSY' | 'INSECURE' | 'UNSUPPORTED';

/**
 * Failure kinds shown to the student. In every case nothing was recorded, except NETWORK where the
 * outcome is unknown (the request may have reached the server), so the page never claims either way.
 */
type FailureKind = 'NOT_CHECKIN_QR' | 'QR_INVALID' | 'NOT_REGISTERED' | 'INELIGIBLE' | 'NETWORK' | 'OTHER';

type View =
  | { step: 'IDLE' }
  | { step: 'STARTING' }
  | { step: 'SCANNING' }
  | { step: 'CAMERA_ERROR'; problem: CameraProblem }
  | { step: 'CHECKING' }
  | { step: 'CONFIRM'; qr: CheckInQr; preview: AttendancePreview; changed: boolean }
  | { step: 'SUBMITTING'; qr: CheckInQr; preview: AttendancePreview }
  | { step: 'SUCCESS'; title: string; attendance: Attendance; already: boolean }
  | { step: 'FAILED'; kind: FailureKind; title: string; message: string; retry: (() => void) | null };

/** Read a frame this often; enough for a held-up phone and light on the CPU. */
const SCAN_INTERVAL_MS = 150;

/**
 * /scan: student QR check-in (UC-11, mockup `scan()`, docs/api/I3.md "Luồng QR").
 * Camera → decode the session QR → POST preview (read-only) → student presses "Xác nhận" → POST check-in.
 * Nothing is recorded on scan alone, nothing is queued offline, and success is shown only from the server's answer.
 */
@Component({
  selector: 'app-scan',
  imports: [PageHeaderComponent, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Điểm danh bằng QR" subtitle="Quét mã QR do người tổ chức hiển thị tại sự kiện." />

    <div class="scan-shell">
      <section class="panel" aria-labelledby="scan-heading" aria-live="polite">
        <h2 id="scan-heading" class="sr-only">Quét mã điểm danh</h2>

        <!-- The video element stays in the DOM so the scanner can attach to it before it is shown. -->
        <div class="scan-view" [class.live]="view().step === 'SCANNING'">
          <video #video muted playsinline aria-label="Hình ảnh camera" [hidden]="view().step !== 'SCANNING'"></video>
          @if (view().step === 'SCANNING') {
            <div class="scan-frame" aria-hidden="true"></div>
            <span class="scan-hint">Đưa mã QR vào giữa khung</span>
          } @else {
            <div class="scan-target"><app-icon name="qr" /></div>
            <span class="scan-hint">{{ idleHint() }}</span>
          }
        </div>

        @switch (view().step) {
          @case ('IDLE') {
            <div class="notice">Bấm nút bên dưới và cho phép trình duyệt dùng camera. Sau khi quét, bạn sẽ xem lại thông tin sự kiện rồi bấm <b>Xác nhận</b> để điểm danh.</div>
            <button type="button" class="primary block" (click)="startScan()"><app-icon name="camera" /> Bật camera để quét</button>
          }
          @case ('STARTING') {
            <div class="notice">Đang mở camera… Nếu trình duyệt hỏi quyền, hãy chọn <b>Cho phép</b>.</div>
            <button type="button" class="block" (click)="stopScan()">Hủy</button>
          }
          @case ('SCANNING') {
            <button type="button" class="block" (click)="stopScan()"><app-icon name="close" /> Dừng quét</button>
          }
          @case ('CHECKING') {
            <div class="notice" role="status">Đang kiểm tra mã QR…</div>
          }
        }

        @if (cameraProblem(); as problem) {
          <div class="notice warn" role="alert">
            @switch (problem) {
              @case ('DENIED') {
                <b>Trình duyệt đang chặn quyền dùng camera.</b>
                Để bật lại:
                <ul>
                  <li>Máy tính (Chrome, Edge): bấm biểu tượng ổ khóa cạnh thanh địa chỉ → <b>Camera</b> → <b>Cho phép</b>, rồi tải lại trang.</li>
                  <li>Android (Chrome): bấm biểu tượng cạnh địa chỉ trang → <b>Quyền</b> → <b>Camera</b> → <b>Cho phép</b>.</li>
                  <li>iPhone (Safari): bấm <b>aA</b> trên thanh địa chỉ → <b>Cài đặt trang web</b> → <b>Camera</b> → <b>Cho phép</b>; hoặc vào Cài đặt → Safari → Camera.</li>
                </ul>
              }
              @case ('NO_CAMERA') {
                <b>Không tìm thấy camera trên thiết bị này.</b> Hãy dùng điện thoại có camera để quét.
              }
              @case ('BUSY') {
                <b>Camera đang được ứng dụng khác sử dụng.</b> Đóng ứng dụng hoặc tab đang dùng camera rồi thử lại.
              }
              @case ('INSECURE') {
                <b>Trình duyệt chỉ cho dùng camera trên kết nối bảo mật (HTTPS).</b> Hãy mở trang BKevent bằng địa chỉ https:// rồi thử lại.
              }
              @case ('UNSUPPORTED') {
                <b>Trình duyệt này không hỗ trợ camera.</b> Hãy mở trang bằng Chrome, Edge hoặc Safari phiên bản mới.
              }
            }
            <p class="gap-top">Nếu vẫn không quét được, hãy báo MSSV cho người tổ chức để được điểm danh thủ công.</p>
          </div>
          <button type="button" class="primary block" (click)="startScan()"><app-icon name="camera" /> Thử lại</button>
        }

        @if (confirmView(); as c) {
          <div class="confirm">
            <span class="eyebrow">Xác nhận điểm danh</span>
            <h3>{{ c.preview.title }}</h3>
            @if (c.changed) {
              <div class="notice warn" role="alert">Thông tin sự kiện hoặc đăng ký vừa thay đổi. Vui lòng xem lại rồi xác nhận lần nữa.</div>
            }
            <div class="info-row"><span>Địa điểm</span><b>{{ c.preview.location }}</b></div>
            <div class="info-row"><span>Thời gian</span><b>{{ day(c.preview.startsAt) }} · {{ range(c.preview.startsAt, c.preview.endsAt) }}</b></div>
            <div class="info-row"><span>Mã có hiệu lực đến</span><b>{{ time(c.preview.expiresAt) }}</b></div>
            <p class="small-text muted gap-top">Điểm danh chỉ được ghi nhận sau khi bạn bấm Xác nhận.</p>
            <div class="actions gap-top">
              <button type="button" [disabled]="submitting()" (click)="reset()">Hủy</button>
              <button type="button" class="primary" [disabled]="submitting()" (click)="confirm()">
                <app-icon name="check" /> {{ submitting() ? 'Đang xác nhận…' : 'Xác nhận điểm danh' }}
              </button>
            </div>
          </div>
        }

        @if (successView(); as s) {
          <div class="result">
            <div class="result-icon ok"><app-icon name="check" /></div>
            <h3>{{ s.already ? 'Bạn đã điểm danh trước đó' : 'Điểm danh thành công' }}</h3>
            <p class="muted">{{ s.title }}</p>
            <div class="info-row"><span>Trạng thái</span><b><span class="badge">Có mặt</span></b></div>
            <div class="info-row"><span>Thời điểm ghi nhận</span><b>{{ stamp(s.attendance.recordedAt) }}</b></div>
            <div class="info-row"><span>Phương thức</span><b>{{ method(s.attendance) }}</b></div>
            @if (s.already) {
              <p class="small-text muted gap-top">Kết quả đã có sẵn, hệ thống không ghi thêm lượt mới.</p>
            }
            <button type="button" class="block gap-top" (click)="reset()">Xong</button>
          </div>
        }

        @if (failedView(); as f) {
          <div class="result">
            <div class="result-icon bad"><app-icon name="alert" /></div>
            <h3>{{ f.title }}</h3>
            <div class="notice warn" role="alert">{{ f.message }}</div>
            <p class="small-text muted">{{ advice(f.kind) }}</p>
            <div class="actions gap-top">
              @if (f.retry) {
                <button type="button" class="primary" (click)="f.retry()">Thử lại</button>
                <button type="button" (click)="startScan()"><app-icon name="camera" /> Quét mã khác</button>
              } @else {
                <button type="button" class="primary" (click)="startScan()"><app-icon name="camera" /> Quét lại</button>
              }
              @if (f.kind === 'NOT_REGISTERED' || f.kind === 'INELIGIBLE') {
                <a class="button" routerLink="/my-events">Sự kiện của tôi</a>
              }
            </div>
          </div>
        }

        <button type="button" class="ghost block gap-top" (click)="showHelp.set(!showHelp())" [attr.aria-expanded]="showHelp()">
          <app-icon name="info" /> Không quét được? Xem hướng dẫn
        </button>
        @if (showHelp()) {
          <div class="notice">
            Nếu đến muộn, thiết bị gặp lỗi, mất mạng hoặc mã đã đóng, hãy báo <b>MSSV</b> cho người tổ chức.
            Người tổ chức sẽ xác minh và ghi nhận thủ công. Ứng dụng không lưu lượt quét để gửi lại sau.
          </div>
        }
      </section>

      @if (registered().length) {
        <section class="panel" aria-labelledby="mine-heading">
          <h3 id="mine-heading">Sự kiện bạn đã đăng ký chính thức</h3>
          <ul class="mine">
            @for (r of registered(); track r.id) {
              <li><a [routerLink]="['/events', r.eventId]">{{ r.eventTitle }}</a><small>{{ day(r.startsAt) }} · {{ range(r.startsAt, r.endsAt) }}</small></li>
            }
          </ul>
          <p class="small-text muted">Chỉ đăng ký chính thức mới được điểm danh. Người trong danh sách chờ hoặc đã hủy không được ghi nhận.</p>
        </section>
      }
    </div>
  `,
  styles: `
    .scan-view { overflow: hidden; height: auto; aspect-ratio: 4 / 3; max-height: 360px; }
    .scan-view video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .scan-frame { position: relative; width: 60%; aspect-ratio: 1; border: 2px solid #ffffffcc; border-radius: 18px; box-shadow: 0 0 0 999px #0006; }
    .scan-hint { z-index: 1; color: #fff; }
    .notice ul { margin: 8px 0 0; padding-left: 18px; }
    .confirm h3, .result h3 { margin-bottom: 8px; overflow-wrap: anywhere; }
    .result { text-align: center; }
    .result .info-row { text-align: left; }
    .result .actions { justify-content: center; }
    .result-icon { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; margin: 4px auto 12px; }
    .result-icon.ok { background: var(--mint); color: var(--green); }
    .result-icon.bad { background: #fff0f0; color: #b24b58; }
    .result-icon svg { width: 26px; height: 26px; }
    .mine { list-style: none; padding: 0; margin: 12px 0; }
    .mine li { padding: 10px 0; border-bottom: 1px solid var(--line); }
    .mine li:last-child { border-bottom: 0; }
    .mine a { font-weight: 600; color: var(--blue); }
    .mine small { display: block; color: var(--muted); }
  `,
})
export class ScanPage {
  private readonly attendance = inject(AttendanceApi);
  private readonly registrations = inject(RegistrationApi);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly stamp = formatDateTime;
  protected readonly time = formatTime;
  protected readonly range = formatTimeRange;
  protected readonly day = formatLongDate;
  protected readonly method = (a: Attendance) => METHOD_LABEL[a.method];

  protected readonly view = signal<View>({ step: 'IDLE' });
  protected readonly showHelp = signal(false);
  protected readonly registered = signal<Registration[]>([]);

  protected readonly cameraProblem = computed(() => {
    const v = this.view();
    return v.step === 'CAMERA_ERROR' ? v.problem : null;
  });
  protected readonly confirmView = computed(() => {
    const v = this.view();
    if (v.step === 'CONFIRM') return v;
    return v.step === 'SUBMITTING' ? { ...v, changed: false } : null;
  });
  protected readonly submitting = computed(() => this.view().step === 'SUBMITTING');
  protected readonly successView = computed(() => {
    const v = this.view();
    return v.step === 'SUCCESS' ? v : null;
  });
  protected readonly failedView = computed(() => {
    const v = this.view();
    return v.step === 'FAILED' ? v : null;
  });
  protected readonly idleHint = computed(() => {
    const step = this.view().step;
    if (step === 'STARTING') return 'Đang mở camera…';
    if (step === 'CHECKING' || step === 'CONFIRM' || step === 'SUBMITTING') return 'Đã đọc mã QR';
    return 'Camera chưa bật';
  });

  private controls: IScannerControls | null = null;
  /** Incremented on every new scan or reset, so late answers of an abandoned attempt are ignored. */
  private attempt = 0;
  private registrationLoad = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.attempt++;
      this.registrationLoad++;
      this.stopCamera();
    });
    void this.loadRegistered();
  }

  // ── Camera ──

  protected async startScan(): Promise<void> {
    const attempt = ++this.attempt;
    this.stopCamera();
    if (!window.isSecureContext) return this.view.set({ step: 'CAMERA_ERROR', problem: 'INSECURE' });
    if (!navigator.mediaDevices?.getUserMedia) return this.view.set({ step: 'CAMERA_ERROR', problem: 'UNSUPPORTED' });

    this.view.set({ step: 'STARTING' });
    try {
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: SCAN_INTERVAL_MS });
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        this.video().nativeElement,
        (result, _error, scanControls) => {
          // Frames without a code report an error here; only a decoded result matters.
          if (!result || attempt !== this.attempt) return;
          scanControls.stop();
          this.controls = null;
          void this.handleScan(result.getText(), attempt);
        },
      );
      if (attempt !== this.attempt || this.view().step !== 'STARTING') return controls.stop();
      this.controls = controls;
      this.view.set({ step: 'SCANNING' });
    } catch (error) {
      if (attempt === this.attempt) this.view.set({ step: 'CAMERA_ERROR', problem: cameraProblem(error) });
    }
  }

  protected stopScan(): void {
    this.attempt++;
    this.stopCamera();
    this.view.set({ step: 'IDLE' });
  }

  protected reset(): void {
    this.stopScan();
  }

  private stopCamera(): void {
    this.controls?.stop();
    this.controls = null;
  }

  // ── Preview and confirmation ──

  private async handleScan(text: string, attempt: number): Promise<void> {
    const qr = parseCheckInQr(text);
    if (!qr) {
      return this.fail('NOT_CHECKIN_QR', 'Mã QR không đúng', 'Đây không phải mã điểm danh BKevent. Điểm danh chưa được ghi nhận.', null);
    }
    await this.runPreview(qr, attempt, false);
  }

  private async runPreview(qr: CheckInQr, attempt: number, changed: boolean): Promise<void> {
    this.view.set({ step: 'CHECKING' });
    try {
      const preview = await this.attendance.preview(qr);
      if (attempt !== this.attempt) return;
      if (preview.alreadyPresent) return this.showExisting(qr.eventId, preview.title, attempt);
      this.view.set({ step: 'CONFIRM', qr, preview, changed });
    } catch (error) {
      if (attempt === this.attempt) await this.handleError(error, qr, attempt, () => void this.runPreview(qr, ++this.attempt, false));
    }
  }

  protected async confirm(): Promise<void> {
    const v = this.view();
    if (v.step !== 'CONFIRM') return;
    const { qr, preview } = v;
    const request: CheckInRequest = {
      sessionId: qr.sessionId,
      token: qr.token,
      eventVersion: preview.eventVersion,
      registrationVersion: preview.registrationVersion,
      attendanceVersion: preview.attendanceVersion,
    };
    await this.submit(qr, preview, request, this.attempt);
  }

  /** Re-sending the same request is safe: the server returns the existing result when already PRESENT. */
  private async submit(qr: CheckInQr, preview: AttendancePreview, request: CheckInRequest, attempt: number): Promise<void> {
    this.view.set({ step: 'SUBMITTING', qr, preview });
    try {
      const attendance = await this.attendance.checkIn(qr.eventId, request);
      if (attempt !== this.attempt) return;
      if (attendance.result !== 'PRESENT') throw new ApiError(0, 'UNEXPECTED_RESULT', 'Máy chủ chưa xác nhận kết quả có mặt.');
      this.view.set({ step: 'SUCCESS', title: preview.title, attendance, already: attendance.method !== 'QR' || attendance.sessionId !== qr.sessionId });
      void this.loadRegistered();
    } catch (error) {
      if (attempt !== this.attempt) return;
      if (error instanceof ApiError && error.code === 'CONFIRMATION_STALE') {
        // Never re-send silently with new versions: show the fresh preview and let the student confirm again.
        return this.runPreview(qr, attempt, true);
      }
      await this.handleError(error, qr, attempt, () => void this.submit(qr, preview, request, ++this.attempt), preview.title);
    }
  }

  // ── Results ──

  /** Shows the student's current attendance record (already PRESENT), read from the server. */
  private async showExisting(eventId: number, title: string, attempt: number): Promise<void> {
    try {
      const mine = await this.attendance.mine(eventId);
      if (attempt !== this.attempt) return;
      if (mine.registrationStatus === 'REGISTERED' && mine.attendanceState === 'PRESENT' && mine.attendance?.result === 'PRESENT') {
        this.view.set({ step: 'SUCCESS', title, attendance: mine.attendance, already: true });
        return;
      }
      if (mine.registrationStatus !== 'REGISTERED') {
        this.fail('INELIGIBLE', 'Chưa đủ điều kiện điểm danh', 'Đăng ký hiện tại không phải đăng ký chính thức. Điểm danh chưa được ghi nhận.', null);
        return;
      }
      this.fail('OTHER', 'Chưa xác định được kết quả', 'Không đọc được kết quả điểm danh hiện tại. Vui lòng quét lại.', null);
    } catch (error) {
      if (attempt === this.attempt) {
        this.fail('NETWORK', 'Chưa xác nhận được kết quả', `Không đọc được kết quả điểm danh của bạn. ${errorMessage(error)}`, () =>
          void this.showExisting(eventId, title, ++this.attempt),
        );
      }
    }
  }

  private async handleError(error: unknown, qr: CheckInQr, attempt: number, retry: () => void, title?: string): Promise<void> {
    const code = error instanceof ApiError ? error.code : '';
    const status = error instanceof ApiError ? error.status : 0;
    const server = errorMessage(error);

    switch (code) {
      case 'QR_SESSION_INVALID':
      case 'QR_SESSION_NOT_FOUND':
      case 'ATTENDANCE_CLOSED':
      case 'EVENT_NOT_FOUND': {
        // A student who checked in earlier and scans an old code is still present: show that instead of an error.
        if (await this.alreadyPresent(qr.eventId, title ?? '', attempt)) return;
        if (attempt !== this.attempt) return;
        return this.fail('QR_INVALID', 'Mã QR không còn hiệu lực', `${server} Điểm danh chưa được ghi nhận.`, null);
      }
      case 'REGISTRATION_NOT_FOUND':
        return this.fail('NOT_REGISTERED', 'Bạn chưa đăng ký sự kiện này', 'Chỉ sinh viên đã đăng ký chính thức mới được điểm danh. Điểm danh chưa được ghi nhận.', null);
      case 'REGISTRATION_NOT_CONFIRMED': {
        const message = await this.ineligibleMessage(qr.eventId, server);
        if (attempt !== this.attempt) return;
        return this.fail('INELIGIBLE', 'Chưa đủ điều kiện điểm danh', message, null);
      }
    }

    if (status === 0 || status >= 500 || code === 'UNEXPECTED_RESULT') {
      return this.fail(
        'NETWORK',
        'Chưa xác nhận được điểm danh',
        `Không xác nhận được điểm danh do lỗi kết nối hoặc máy chủ. ${server} Đừng coi là đã điểm danh cho đến khi thấy thông báo thành công.`,
        retry,
      );
    }
    this.fail('OTHER', 'Điểm danh chưa được ghi nhận', server, null);
  }

  private async alreadyPresent(eventId: number, title: string, attempt: number): Promise<boolean> {
    try {
      const mine = await this.attendance.mine(eventId);
      if (attempt !== this.attempt || mine.attendance?.result !== 'PRESENT' || mine.registrationStatus !== 'REGISTERED' || mine.attendanceState !== 'PRESENT') return false;
      this.view.set({ step: 'SUCCESS', title: title || this.titleOf(eventId), attendance: mine.attendance, already: true });
      return true;
    } catch {
      return false;
    }
  }

  private async ineligibleMessage(eventId: number, fallback: string): Promise<string> {
    const suffix = ' Chỉ đăng ký chính thức mới được điểm danh. Điểm danh chưa được ghi nhận.';
    try {
      const status = (await this.attendance.mine(eventId)).registrationStatus;
      if (status === 'WAITLISTED') return 'Bạn đang ở danh sách chờ của sự kiện này.' + suffix;
      if (status === 'CANCELLED') return 'Bạn đã hủy đăng ký sự kiện này.' + suffix;
    } catch {
      // Fall back to the server's message.
    }
    return fallback + ' Điểm danh chưa được ghi nhận.';
  }

  private fail(kind: FailureKind, title: string, message: string, retry: (() => void) | null): void {
    this.view.set({ step: 'FAILED', kind, title, message, retry });
  }

  protected advice(kind: FailureKind): string {
    if (kind === 'NETWORK') return 'Kiểm tra kết nối mạng rồi bấm Thử lại. Nếu vẫn lỗi, hãy báo MSSV cho người tổ chức để được điểm danh thủ công.';
    if (kind === 'NOT_CHECKIN_QR') return 'Hãy quét đúng mã QR người tổ chức đang hiển thị cho sự kiện.';
    return 'Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ người tổ chức để được xác minh và điểm danh thủ công.';
  }

  // ── Registered events (context list) ──

  private async loadRegistered(): Promise<void> {
    const load = ++this.registrationLoad;
    try {
      const now = Date.now();
      const registrations = new Map<number, Registration>();
      for (let index = 0; ; index++) {
        const page = await this.registrations.mine('REGISTERED', index, 100);
        if (load !== this.registrationLoad) return;
        const before = registrations.size;
        page.items.forEach((registration) => registrations.set(registration.eventId, registration));
        if (!page.hasNext) break;
        if (registrations.size === before) throw new Error('Không tải được trang đăng ký tiếp theo.');
      }
      this.registered.set([...registrations.values()].filter((r) => Date.parse(r.endsAt) > now));
    } catch {
      // Optional context only; scanning works without it.
    }
  }

  private titleOf(eventId: number): string {
    return this.registered().find((r) => r.eventId === eventId)?.eventTitle ?? 'Sự kiện';
  }
}

/** Maps getUserMedia errors (DOMException names) to the instructions to show. */
function cameraProblem(error: unknown): CameraProblem {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'DENIED';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'NO_CAMERA';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'BUSY';
  return 'UNSUPPORTED';
}
