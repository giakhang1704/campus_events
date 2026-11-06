import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

import { Api, ApiError, Catalog, User } from '../../core/api';

/** Server preview of a status change, confirmed before it is saved. */
interface ChangePreview {
  before: User;
  role: string;
  status: string;
  organizationUnitId: number | null;
  reason: string;
  changed: boolean;
  impact: string;
}

/** Organizer account request, reviewed by the admin before it is sent. */
interface OrganizerRequest {
  fullName: string;
  email: string;
  temporaryPassword: string;
  organizationUnitId: number | null;
  reason: string;
}

/** Avatar colours (background, text): soft tints of the palette, each pair readable at AA. */
const AVATAR_COLORS: [string, string][] = [
  ['#e9eff9', '#032b91'],
  ['#e3f8f0', '#137a5b'],
  ['#fff1e6', '#94560a'],
  ['#f0ebfa', '#5b3a9b'],
  ['#e6f4fb', '#0b5c86'],
  ['#fdeaea', '#9b2c2c'],
];

/** /admin/accounts: search accounts, create organizer accounts, lock / unlock accounts. */
@Component({
  selector: 'app-accounts',
  imports: [FormsModule],
  templateUrl: './accounts.component.html',
  styles: `
    td,
    th {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Name column wraps normally. */
    td:first-child {
      white-space: normal;
    }
  `,
})
export class AccountsComponent {
  readonly api = inject(Api);

  readonly items = signal<User[]>([]);
  readonly units = signal<Catalog[]>([]);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly fields = signal<Record<string, string>>({});
  readonly hasNext = signal(false);

  // Search and paging
  /** Increases on every load; an older response that arrives late is ignored. */
  private loadSeq = 0;
  q = '';
  filterRole = '';
  filterStatus = '';
  page = 0;

  // Lock / unlock
  selected: User | null = null;
  reason = '';
  preview: ChangePreview | null = null;

  // Create organizer account
  creating = false;
  name = '';
  email = '';
  temporary = '';
  unit: number | null = null;
  createReason = '';
  createReview: OrganizerRequest | null = null;

  /**
   * Accounts of the loaded page that match the search box while typing (name, email or student code).
   * Only filters what is on screen; "Tìm kiếm" still searches every account on the server.
   */
  get filteredAccounts(): User[] {
    const keyword = this.q.trim().toLowerCase();
    if (!keyword) return this.items();
    return this.items().filter((u) =>
      [u.fullName, u.email, u.studentCode ?? ''].some((field) => field.toLowerCase().includes(keyword)),
    );
  }

  constructor() {
    void this.load();
    this.api
      .request<Catalog[]>('/catalog/organization-units')
      .then((x) => this.units.set(x))
      .catch(() => this.message.set('Không tải được đơn vị. Vui lòng tải lại trang.'));
  }

  roleLabel(role: string): string {
    return ({ STUDENT: 'Sinh viên', ORGANIZER: 'Người tổ chức', ADMIN: 'Quản trị viên' } as Record<string, string>)[role] || role;
  }

  statusLabel(status: string): string {
    return status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa';
  }

  /** Two letters from the last two words of the name, as in the top bar ("Nguyễn Thu Hà" -> "TH"). */
  initials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  /**
   * Same name, same colour, on every visit, without storing anything.
   *
   * A hash turns the name into one number: for each character, multiply the running total by 31 and add
   * the character's code (the same scheme as Java's String.hashCode). Multiplying by a prime spreads
   * similar names ("Admin I1", "Admin 2 I1") far apart. `>>> 0` keeps the number a positive 32-bit integer
   * so it never grows without bound. The remainder `hash % AVATAR_COLORS.length` picks one of the colour pairs.
   */
  avatarStyle(name: string): Record<string, string> {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
    const [background, color] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
    return { background, color };
  }

  /** Role and status filters apply as soon as a value is picked; the text search still uses the button. */
  onFilterChange(): void {
    this.page = 0;
    void this.load();
  }

  unitLabel(id: number | null): string {
    return this.units().find((u) => u.id === id)?.name || (id === null ? 'Không áp dụng' : String(id));
  }

  async load(): Promise<boolean> {
    const seq = ++this.loadSeq;
    this.busy.set(true);
    this.message.set('');
    try {
      const params = new URLSearchParams({
        q: this.q,
        role: this.filterRole,
        status: this.filterStatus,
        page: String(this.page),
        size: '10',
      });
      const result = await this.api.request<{ items: User[]; hasNext: boolean }>('/admin/users?' + params);
      if (seq !== this.loadSeq) return true; // a newer filter or search already started
      this.items.set(result.items);
      this.hasNext.set(result.hasNext);
      return true;
    } catch (e) {
      if (seq !== this.loadSeq) return false;
      this.items.set([]);
      this.hasNext.set(false);
      this.message.set(e instanceof Error ? e.message : 'Không tải được tài khoản. Vui lòng thử lại.');
      return false;
    } finally {
      if (seq === this.loadSeq) this.busy.set(false);
    }
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
    if (this.creating) {
      this.cancelCreate();
    } else {
      this.creating = true;
      this.cancelEdit();
      this.message.set('');
    }
  }

  edit(user: User): void {
    this.cancelCreate();
    this.selected = user;
    this.reason = '';
    this.preview = null;
    this.message.set('');
  }

  /** Step 1 of lock / unlock: ask the server what the change would do. */
  async save(form: NgForm): Promise<void> {
    if (!this.selected || this.busy()) return;
    if (form.invalid || !this.reason.trim()) {
      this.message.set('Vui lòng nhập lý do hợp lệ.');
      return;
    }

    this.busy.set(true);
    this.message.set('');
    try {
      const u = this.selected;
      const body = { status: u.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE', version: u.version, reason: this.reason.trim() };
      const result = await this.api.request<ChangePreview>('/admin/users/' + u.id + '/status/preview', 'POST', body);
      if (result.changed) {
        this.preview = result;
      } else {
        this.cancelEdit();
        this.message.set('Không có thay đổi.');
      }
    } catch (e) {
      this.message.set(e instanceof Error ? e.message : 'Không kiểm tra được điều kiện thay đổi.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Step 2 of lock / unlock: save the previewed change. */
  async confirmSave(): Promise<void> {
    const preview = this.preview;
    if (!preview || this.busy()) return;

    this.busy.set(true);
    try {
      const body = { status: preview.status, version: preview.before.version, reason: preview.reason };
      await this.api.request('/admin/users/' + preview.before.id + '/status', 'PATCH', body);
      this.cancelEdit();
      if (await this.load()) this.message.set('Đã cập nhật tài khoản.');
    } catch (e) {
      this.preview = null;
      this.message.set(e instanceof Error ? e.message : 'Không lưu được.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Step 1 of create: check the form and show the confirmation. */
  reviewCreate(form: NgForm): void {
    this.fields.set({});
    this.message.set('');

    const fields: Record<string, string> = {};
    if (!this.name.trim()) fields['fullName'] = 'Vui lòng nhập họ tên.';
    if (!this.email || form.controls['email']?.invalid) fields['email'] = 'Vui lòng nhập email hợp lệ.';
    if (this.temporary.length < 8 || new TextEncoder().encode(this.temporary).length > 72) {
      fields['temporaryPassword'] = 'Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.';
    }
    if (!this.unit) fields['organizationUnitId'] = 'Vui lòng chọn đơn vị.';
    if (!this.createReason.trim()) fields['reason'] = 'Vui lòng nhập lý do cấp quyền.';

    if (form.invalid || Object.keys(fields).length) {
      this.fields.set(fields);
      this.message.set('Vui lòng kiểm tra các trường được đánh dấu.');
      return;
    }

    this.createReview = {
      fullName: this.name.trim(),
      email: this.email,
      temporaryPassword: this.temporary,
      organizationUnitId: this.unit,
      reason: this.createReason.trim(),
    };
  }

  /** Step 2 of create: send the reviewed request. */
  async create(): Promise<void> {
    if (!this.createReview || this.busy()) return;

    this.busy.set(true);
    try {
      await this.api.request('/admin/users', 'POST', this.createReview);
      this.cancelCreate();
      if (await this.load()) this.message.set('Đã cấp tài khoản; người nhận cần đổi mật khẩu.');
    } catch (e) {
      this.createReview = null;
      if (e instanceof ApiError) {
        this.fields.set({ ...e.fields, ...(e.fields['password'] ? { temporaryPassword: e.fields['password'] } : {}) });
      }
      this.message.set(e instanceof Error ? e.message : 'Không tạo được tài khoản.');
    } finally {
      this.busy.set(false);
    }
  }
}
