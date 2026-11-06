import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Api, ApiError, User, Catalog } from '../../core/api';

interface ChangePreview {
  before: User;
  role: string;
  status: string;
  organizationUnitId: number | null;
  reason: string;
  changed: boolean;
  impact: string;
}

interface OrganizerRequest {
  fullName: string;
  email: string;
  temporaryPassword: string;
  organizationUnitId: number | null;
  reason: string;
}

interface AccountListResponse {
  items: User[];
  hasNext: boolean;
}

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [FormsModule],
  styleUrl: './accounts.component.css',
  template: `
    <!-- Tiêu đề trang -->
    <div class="section-title">
      <div>
        <h1>Quản lý tài khoản</h1>
        <p class="muted">
          Tra cứu, cấp tài khoản và khóa/mở quyền truy cập.
          Mỗi tài khoản có một vai trò cố định.
        </p>
      </div>

      <button
        type="button"
        [disabled]="busy()"
        (click)="toggleCreate()">
        {{ creating ? 'Đóng form' : 'Cấp tài khoản người tổ chức' }}
      </button>
    </div>

    <!-- Thống kê theo trang danh sách đang xem -->
    <section
      class="account-summary"
      aria-label="Thống kê trang hiện tại">

      <div class="account-summary-heading">
        <h2>Tổng quan trang hiện tại</h2>
        <p>Số liệu theo bộ lọc và trang danh sách đang xem.</p>
      </div>

      <div
        class="account-stats"
        aria-live="polite"
        [attr.aria-busy]="busy()">

        <article class="account-stat">
          <span>Tài khoản trên trang</span>
          <strong>{{ busy() ? '…' : accountStats().total }}</strong>
          <small>Tất cả vai trò</small>
        </article>

        <article class="account-stat purple">
          <span>Sinh viên</span>
          <strong>{{ busy() ? '…' : accountStats().students }}</strong>
          <small>Tài khoản sinh viên trên trang</small>
        </article>

        <article class="account-stat green">
          <span>Người tổ chức</span>
          <strong>{{ busy() ? '…' : accountStats().organizers }}</strong>
          <small>Tài khoản tổ chức trên trang</small>
        </article>

        <article class="account-stat amber">
          <span>Đã khóa</span>
          <strong>{{ busy() ? '…' : accountStats().locked }}</strong>
          <small>Tài khoản bị khóa trên trang</small>
        </article>
      </div>
    </section>

    @if (message()) {
      <p class="notice" role="status">{{ message() }}</p>
    }

    <!-- Cấp tài khoản người tổ chức -->
    @if (creating) {
      <section class="panel account-create-panel">
        <div class="account-form-heading">
          <span class="account-form-tag">THÊM THÀNH VIÊN</span>
          <h2>Cấp tài khoản người tổ chức</h2>
          <p>Nhập thông tin người phụ trách và đơn vị tổ chức.</p>
        </div>

        @if (createReview) {
          <h3>Xác nhận cấp tài khoản</h3>

          <p><strong>Họ tên:</strong> {{ createReview.fullName }}</p>
          <p><strong>Email:</strong> {{ createReview.email }}</p>
          <p><strong>Vai trò:</strong> Người tổ chức</p>
          <p>
            <strong>Đơn vị:</strong>
            {{ unitLabel(createReview.organizationUnitId) }}
          </p>
          <p><strong>Lý do:</strong> {{ createReview.reason }}</p>

          <p class="notice">
            Chỉ cấp cho người đã được phân công và đối chiếu thông tin.
            Bàn giao mật khẩu tạm riêng cho đúng người.
            Người nhận phải đổi mật khẩu khi đăng nhập lần đầu.
            Không công khai mật khẩu trong danh sách tài khoản.
          </p>

          <div class="account-form-actions">
            <button
              type="button"
              class="secondary"
              [disabled]="busy()"
              (click)="cancelCreate()">
              Hủy bỏ
            </button>

            <button
              type="button"
              class="secondary"
              [disabled]="busy()"
              (click)="createReview = null">
              Chỉnh sửa thông tin
            </button>

            <button
              type="button"
              [disabled]="busy()"
              (click)="create()">
              {{ busy() ? 'Đang xử lý…' : 'Xác nhận cấp tài khoản' }}
            </button>
          </div>
        } @else {
          <form
            #createForm="ngForm"
            (ngSubmit)="reviewCreate(createForm)">

            <div class="columns">
              <label>
                Họ và tên
                <input
                  name="name"
                  [(ngModel)]="name"
                  required
                  maxlength="150"
                  autocomplete="name"
                  [disabled]="busy()">

                @if (fields()['fullName']) {
                  <small class="field-error">
                    {{ fields()['fullName'] }}
                  </small>
                }
              </label>

              <label>
                Email
                <input
                  type="email"
                  email
                  name="email"
                  [(ngModel)]="email"
                  required
                  maxlength="254"
                  autocomplete="email"
                  [disabled]="busy()">

                @if (fields()['email']) {
                  <small class="field-error">
                    {{ fields()['email'] }}
                  </small>
                }
              </label>

              <label>
                Mật khẩu tạm
                <input
                  type="password"
                  name="temporary"
                  [(ngModel)]="temporary"
                  required
                  minlength="8"
                  maxlength="72"
                  autocomplete="new-password"
                  [disabled]="busy()">

                @if (fields()['temporaryPassword']) {
                  <small class="field-error">
                    {{ fields()['temporaryPassword'] }}
                  </small>
                }
              </label>

              <label>
                Đơn vị tổ chức
                <select
                  name="unit"
                  [(ngModel)]="unit"
                  required
                  [disabled]="busy()">
                  <option [ngValue]="null">Chọn đơn vị</option>

                  @for (d of units(); track d.id) {
                    <option [ngValue]="d.id">{{ d.name }}</option>
                  }
                </select>

                @if (fields()['organizationUnitId']) {
                  <small class="field-error">
                    {{ fields()['organizationUnitId'] }}
                  </small>
                }
              </label>
            </div>

            <label>
              Lý do cấp tài khoản
              <textarea
                name="createReason"
                [(ngModel)]="createReason"
                required
                maxlength="1000"
                rows="4"
                [disabled]="busy()"></textarea>

              @if (fields()['reason']) {
                <small class="field-error">
                  {{ fields()['reason'] }}
                </small>
              }
            </label>

            <p class="muted">
              Tài khoản sinh viên được tự đăng ký.
              Nếu email đã tồn tại, hãy tra cứu hoặc liên hệ người phụ trách.
              Không thể đổi vai trò của tài khoản đã tạo.
            </p>

            <div class="account-form-actions">
              <button
                type="button"
                class="secondary"
                [disabled]="busy()"
                (click)="cancelCreate()">
                Hủy bỏ
              </button>

              <button type="submit" [disabled]="busy()">
                Xem lại thông tin
              </button>
            </div>
          </form>
        }
      </section>
    }

    <!-- Khóa / mở khóa tài khoản -->
    @if (selected) {
      <section class="panel account-create-panel">
        <div class="account-form-heading">
          <span class="account-form-tag">QUẢN LÝ TRUY CẬP</span>
          <h2>Đổi trạng thái tài khoản</h2>
          <p>{{ selected.fullName }} · {{ selected.email }}</p>
        </div>

        @if (preview) {
          <h3>Xác nhận thay đổi tài khoản</h3>

          <p>
            <strong>Tài khoản:</strong>
            {{ preview.before.fullName }} · {{ preview.before.email }}
          </p>

          @if (preview.before.studentCode) {
            <p>
              <strong>Mã sinh viên:</strong>
              {{ preview.before.studentCode }}
            </p>
          }

          <p>
            <strong>Vai trò cố định:</strong>
            {{ roleLabel(preview.before.role) }}
          </p>

          <p>
            <strong>Trạng thái:</strong>
            {{ statusLabel(preview.before.status) }}
            →
            {{ statusLabel(preview.status) }}
          </p>

          <p>
            <strong>Đơn vị:</strong>
            {{ unitLabel(preview.before.organizationUnitId) }}
          </p>

          <p><strong>Lý do:</strong> {{ preview.reason }}</p>

          <p class="notice">{{ preview.impact }}</p>

          <div class="account-form-actions">
            <button
              type="button"
              class="secondary"
              [disabled]="busy()"
              (click)="cancelEdit()">
              Hủy bỏ
            </button>

            <button
              type="button"
              class="secondary"
              [disabled]="busy()"
              (click)="preview = null">
              Quay lại
            </button>

            <button
              type="button"
              [disabled]="busy()"
              (click)="confirmSave()">
              {{ busy() ? 'Đang lưu…' : 'Xác nhận lưu' }}
            </button>
          </div>
        } @else {
          <p>
            <strong>Vai trò:</strong>
            {{ roleLabel(selected.role) }}
          </p>

          <p>
            <strong>Trạng thái hiện tại:</strong>
            {{ statusLabel(selected.status) }}
          </p>

          <p>
            <strong>Chuyển sang:</strong>
            {{ selected.status === 'ACTIVE' ? 'Đã khóa' : 'Hoạt động' }}
          </p>

          <form
            #changeForm="ngForm"
            (ngSubmit)="save(changeForm)">

            <label>
              Lý do thay đổi
              <textarea
                name="reason"
                [(ngModel)]="reason"
                required
                maxlength="1000"
                rows="4"
                [disabled]="busy()"></textarea>
            </label>

            <div class="account-form-actions">
              <button
                type="button"
                class="secondary"
                [disabled]="busy()"
                (click)="cancelEdit()">
                Hủy bỏ
              </button>

              <button type="submit" [disabled]="busy()">
                {{ busy() ? 'Đang kiểm tra…' : 'Xem lại thay đổi' }}
              </button>
            </div>
          </form>
        }
      </section>
    }

    <!-- Danh sách tài khoản -->
    <section class="panel" [attr.aria-busy]="busy()">
      <form class="search-row" (ngSubmit)="search()">
        <input
          name="search"
          aria-label="Tìm tài khoản"
          placeholder="Họ tên, email hoặc MSSV"
          [(ngModel)]="q"
          maxlength="100"
          [disabled]="busy()">

        <select
          aria-label="Lọc vai trò"
          name="filterRole"
          [(ngModel)]="filterRole"
          [disabled]="busy()">
          <option value="">Tất cả vai trò</option>
          <option value="STUDENT">Sinh viên</option>
          <option value="ORGANIZER">Người tổ chức</option>
          <option value="ADMIN">Quản trị viên</option>
        </select>

        <select
          aria-label="Lọc trạng thái"
          name="filterStatus"
          [(ngModel)]="filterStatus"
          [disabled]="busy()">
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="LOCKED">Đã khóa</option>
        </select>

        <button type="submit" [disabled]="busy()">
          Tìm kiếm
        </button>
      </form>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Tài khoản</th>
              <th scope="col">Vai trò</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            @for (u of items(); track u.id) {
              <tr>
                <td>
                  <strong>{{ u.fullName }}</strong>
                  <small>{{ u.email }}</small>

                  @if (u.studentCode) {
                    <small>MSSV: {{ u.studentCode }}</small>
                  }
                </td>

                <td>{{ roleLabel(u.role) }}</td>

                <td>
                  <span
                    class="badge"
                    [class.red]="u.status === 'LOCKED'">
                    {{ statusLabel(u.status) }}
                  </span>
                </td>

                <td>
                  <button
                    type="button"
                    class="secondary"
                    [disabled]="u.id === api.user()?.id || busy()"
                    (click)="edit(u)">
                    {{ u.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">
                  {{ busy() ? 'Đang tải…' : 'Không có tài khoản phù hợp.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="pager">
        <button
          type="button"
          class="secondary"
          [disabled]="page === 0 || busy()"
          (click)="changePage(-1)">
          Trước
        </button>

        <span>Trang {{ page + 1 }}</span>

        <button
          type="button"
          class="secondary"
          [disabled]="!hasNext() || busy()"
          (click)="changePage(1)">
          Tiếp
        </button>
      </div>
    </section>
  `
})
export class AccountsComponent {
  api = inject(Api);

  items = signal<User[]>([]);
  units = signal<Catalog[]>([]);
  busy = signal(false);
  message = signal('');
  fields = signal<Record<string, string>>({});
  hasNext = signal(false);

  // Chỉ thống kê dữ liệu trên trang hiện tại.
  accountStats = computed(() => {
    const users = this.items();

    return {
      total: users.length,
      students: users.filter(u => u.role === 'STUDENT').length,
      organizers: users.filter(u => u.role === 'ORGANIZER').length,
      locked: users.filter(u => u.status === 'LOCKED').length
    };
  });

  q = '';
  filterRole = '';
  filterStatus = '';
  page = 0;

  creating = false;
  selected: User | null = null;

  reason = '';
  name = '';
  email = '';
  temporary = '';
  unit: number | null = null;
  createReason = '';

  preview: ChangePreview | null = null;
  createReview: OrganizerRequest | null = null;

  constructor() {
    void this.load();

    this.api
      .request<Catalog[]>('/catalog/organization-units')
      .then(result => this.units.set(result))
      .catch(() => {
        this.message.set('Không tải được đơn vị. Vui lòng tải lại trang.');
      });
  }

  roleLabel(role: string): string {
    const labels: Record<string, string> = {
      STUDENT: 'Sinh viên',
      ORGANIZER: 'Người tổ chức',
      ADMIN: 'Quản trị viên'
    };

    return labels[role] || role;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      ACTIVE: 'Hoạt động',
      LOCKED: 'Đã khóa'
    };

    return labels[status] || status;
  }

  unitLabel(id: number | null): string {
    if (id === null) {
      return 'Không áp dụng';
    }

    return this.units().find(unit => unit.id === id)?.name || String(id);
  }

  async load(): Promise<boolean> {
    this.busy.set(true);
    this.message.set('');

    try {
      const params = new URLSearchParams({
        q: this.q.trim(),
        role: this.filterRole,
        status: this.filterStatus,
        page: String(this.page),
        size: '10'
      });

      const result = await this.api.request<AccountListResponse>(
        '/admin/users?' + params
      );

      this.items.set(result.items);
      this.hasNext.set(result.hasNext);

      return true;
    } catch (error) {
      this.items.set([]);
      this.hasNext.set(false);
      this.message.set(
        error instanceof Error
          ? error.message
          : 'Không tải được tài khoản. Vui lòng thử lại.'
      );

      return false;
    } finally {
      this.busy.set(false);
    }
  }

  search(): void {
    if (this.busy()) {
      return;
    }

    this.page = 0;
    void this.load();
  }

  changePage(direction: number): void {
    if (this.busy()) {
      return;
    }

    if (direction < 0 && this.page === 0) {
      return;
    }

    if (direction > 0 && !this.hasNext()) {
      return;
    }

    this.page = Math.max(0, this.page + direction);
    void this.load();
  }

  cancelEdit(): void {
    this.selected = null;
    this.preview = null;
    this.reason = '';
  }

  cancelCreate(): void {
    this.creating = false;
    this.createReview = null;
    this.temporary = '';
    this.fields.set({});
  }

  toggleCreate(): void {
    if (this.busy()) {
      return;
    }

    if (this.creating) {
      this.cancelCreate();
      return;
    }

    this.creating = true;
    this.cancelEdit();
    this.message.set('');
  }

  edit(user: User): void {
    if (this.busy() || user.id === this.api.user()?.id) {
      return;
    }

    this.cancelCreate();
    this.selected = user;
    this.reason = '';
    this.preview = null;
    this.message.set('');
  }

  // Gọi backend kiểm tra trước khi đổi trạng thái.
  async save(form: NgForm): Promise<void> {
    if (!this.selected || this.busy()) {
      return;
    }

    if (form.invalid || !this.reason.trim()) {
      form.control.markAllAsTouched();
      this.message.set('Vui lòng nhập lý do hợp lệ.');
      return;
    }

    this.busy.set(true);
    this.message.set('');

    try {
      const user = this.selected;

      const body = {
        status: user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE',
        version: user.version,
        reason: this.reason.trim()
      };

      const result = await this.api.request<ChangePreview>(
        '/admin/users/' + user.id + '/status/preview',
        'POST',
        body
      );

      if (result.changed) {
        this.preview = result;
      } else {
        this.cancelEdit();
        this.message.set('Không có thay đổi.');
      }
    } catch (error) {
      this.message.set(
        error instanceof Error
          ? error.message
          : 'Không kiểm tra được điều kiện thay đổi.'
      );
    } finally {
      this.busy.set(false);
    }
  }

  async confirmSave(): Promise<void> {
    const preview = this.preview;

    if (!preview || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.message.set('');

    try {
      const body = {
        status: preview.status,
        version: preview.before.version,
        reason: preview.reason
      };

      await this.api.request(
        '/admin/users/' + preview.before.id + '/status',
        'PATCH',
        body
      );

      this.cancelEdit();

      if (await this.load()) {
        this.message.set('Đã cập nhật tài khoản.');
      }
    } catch (error) {
      this.preview = null;
      this.message.set(
        error instanceof Error ? error.message : 'Không lưu được.'
      );
    } finally {
      this.busy.set(false);
    }
  }

  reviewCreate(form: NgForm): void {
    if (this.busy()) {
      return;
    }

    this.fields.set({});
    this.message.set('');

    const fields: Record<string, string> = {};

    if (!this.name.trim()) {
      fields['fullName'] = 'Vui lòng nhập họ tên.';
    }

    if (!this.email.trim() || form.controls['email']?.invalid) {
      fields['email'] = 'Vui lòng nhập email hợp lệ.';
    }

    const passwordBytes = new TextEncoder().encode(this.temporary).length;

    if (this.temporary.length < 8 || passwordBytes > 72) {
      fields['temporaryPassword'] =
        'Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.';
    }

    if (!this.unit) {
      fields['organizationUnitId'] = 'Vui lòng chọn đơn vị.';
    }

    if (!this.createReason.trim()) {
      fields['reason'] = 'Vui lòng nhập lý do cấp quyền.';
    }

    if (form.invalid || Object.keys(fields).length > 0) {
      form.control.markAllAsTouched();
      this.fields.set(fields);
      this.message.set('Vui lòng kiểm tra các trường được đánh dấu.');
      return;
    }

    this.createReview = {
      fullName: this.name.trim(),
      email: this.email.trim(),
      temporaryPassword: this.temporary,
      organizationUnitId: this.unit,
      reason: this.createReason.trim()
    };
  }

  async create(): Promise<void> {
    if (!this.createReview || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.message.set('');

    try {
      await this.api.request(
        '/admin/users',
        'POST',
        this.createReview
      );

      this.cancelCreate();

      // Xóa thông tin sau khi cấp tài khoản thành công.
      this.name = '';
      this.email = '';
      this.unit = null;
      this.createReason = '';

      if (await this.load()) {
        this.message.set(
          'Đã cấp tài khoản; người nhận cần đổi mật khẩu.'
        );
      }
    } catch (error) {
      this.createReview = null;

      if (error instanceof ApiError) {
        this.fields.set({
          ...error.fields,
          ...(error.fields['password']
            ? { temporaryPassword: error.fields['password'] }
            : {})
        });
      }

      this.message.set(
        error instanceof Error
          ? error.message
          : 'Không tạo được tài khoản.'
      );
    } finally {
      this.busy.set(false);
    }
  }
}