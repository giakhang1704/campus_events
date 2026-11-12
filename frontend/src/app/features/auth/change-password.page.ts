import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, ApiError } from '../../core/api';
import { passwordProblem } from '../../shared/password-rules';
import { ToastService } from '../../shared/toast/toast.service';

/**
 * /change-password: required first-login password change (moved from the I1 main.ts).
 * The backend revokes all sessions on success, so the user logs in again with the new password.
 */
@Component({
  selector: 'app-change-password-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-shell">
      <div class="auth-art">
        <div class="brand"><img class="brand-logo" src="/assets/hcmut.png" alt="Logo Bách khoa TP.HCM" width="60" height="48"><span>BK<em>event</em></span></div>
        <div>
          <p class="auth-statement">Đặt mật khẩu của riêng bạn.</p>
          <p>Tài khoản được cấp bằng mật khẩu tạm. Hãy đổi mật khẩu trước khi bắt đầu sử dụng hệ thống.</p>
        </div>
        <small>© BKevent</small>
      </div>
      <div class="auth-content">
        <div class="auth-box">
          <h1>Đổi mật khẩu lần đầu</h1>
          <p>Xin chào <b>{{ api.user()?.fullName }}</b>. Mật khẩu mới cần từ 8 đến 72 ký tự.</p>
          <form (ngSubmit)="submit()">
            <label>Mật khẩu hiện tại
              <input type="password" name="old" [(ngModel)]="oldPassword" required autocomplete="current-password">
              @if (fields()['currentPassword']) { <small class="field-error">{{ fields()['currentPassword'] }}</small> }
            </label>
            <label>Mật khẩu mới
              <input type="password" name="new" [(ngModel)]="newPassword" required minlength="8" maxlength="72" autocomplete="new-password">
              @if (fields()['newPassword']) { <small class="field-error">{{ fields()['newPassword'] }}</small> }
            </label>
            @if (message()) { <p class="notice warn" role="status">{{ message() }}</p> }
            <button type="submit" [disabled]="busy()">{{ busy() ? 'Đang xử lý…' : 'Đổi mật khẩu' }}</button>
          </form>
          <p class="auth-switch">Không phải bạn?<button type="button" class="link" [disabled]="busy()" (click)="logout()">Đăng xuất</button></p>
        </div>
      </div>
    </section>
  `,
})
export class ChangePasswordPage {
  protected readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly fields = signal<Record<string, string>>({});
  protected oldPassword = '';
  protected newPassword = '';

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    const fields: Record<string, string> = {};
    if (!this.oldPassword) fields['currentPassword'] = 'Vui lòng nhập mật khẩu hiện tại.';
    const problem = passwordProblem(this.newPassword);
    if (problem) fields['newPassword'] = problem;
    this.fields.set(fields);
    this.message.set('');
    if (Object.keys(fields).length) return;

    this.busy.set(true);
    try {
      await this.api.request('/auth/password', 'POST', { currentPassword: this.oldPassword, newPassword: this.newPassword });
      this.toast.success('Đã đổi mật khẩu và thu hồi các phiên cũ. Vui lòng đăng nhập lại.');
      this.api.user.set(null);
      await this.router.navigateByUrl('/login');
    } catch (error) {
      if (error instanceof ApiError) this.fields.set(error.fields);
      this.message.set(error instanceof Error ? error.message : 'Không đổi được mật khẩu.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async logout(): Promise<void> {
    try {
      await this.api.logout();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Không đăng xuất được.');
    }
    await this.router.navigateByUrl('/login');
  }
}
