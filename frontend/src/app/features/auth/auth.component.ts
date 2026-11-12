import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

import { Api, ApiError, Catalog } from '../../core/api';
import { IconComponent } from '../../shared/icon/icon.component';

/**
 * Login and student sign-up form.
 * Messages from other screens (logout, password change, session check) arrive as toasts (ToastService).
 * Departments are only needed for sign-up; toggle() loads them on demand.
 */
@Component({
  selector: 'app-auth',
  imports: [FormsModule, IconComponent],
  templateUrl: './auth.component.html',
})
export class AuthComponent {
  /** Field-specific wording for empty required fields. */
  private static readonly REQUIRED: Record<string, string> = {
    email: 'Vui lòng nhập email.',
    password: 'Vui lòng nhập mật khẩu.',
    fullName: 'Vui lòng nhập họ và tên.',
    studentCode: 'Vui lòng nhập mã số sinh viên.',
    departmentId: 'Vui lòng chọn khoa.',
    studyYear: 'Vui lòng nhập năm học.',
  };

  readonly api = inject(Api);

  signup = false;
  email = '';
  password = '';
  fullName = '';
  studentCode = '';
  departmentId: number | null = null;
  studyYear = 1;

  readonly departments = signal<Catalog[]>([]);
  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly message = signal('');
  readonly fields = signal<Record<string, string>>({});

  error(name: string, form: NgForm): string {
    if (this.fields()[name]) return this.fields()[name];

    const control = form.controls[name];
    // Shown once the user leaves the field (touched) or submits.
    if (!control?.invalid || !(form.submitted || control.touched)) return '';
    if (control.hasError('required')) return AuthComponent.REQUIRED[name] ?? 'Vui lòng nhập hoặc chọn thông tin này.';
    if (control.hasError('email')) return 'Email không hợp lệ.';
    if (control.hasError('minlength')) return 'Mật khẩu cần ít nhất 8 ký tự.';
    return 'Giá trị không hợp lệ.';
  }

  toggle(form: NgForm): void {
    this.signup = !this.signup;
    this.showPassword.set(false);
    this.password = '';
    this.fields.set({});
    this.message.set('');
    form.resetForm({ email: this.email, studyYear: 1 });
    if (this.signup && !this.departments().length) this.loadDepartments();
  }

  async submit(form: NgForm): Promise<void> {
    if (this.busy()) return;
    this.fields.set({});
    this.message.set('');

    if (form.invalid) {
      form.control.markAllAsTouched();
      this.message.set('Vui lòng kiểm tra các trường được đánh dấu.');
      return;
    }

    if (this.signup) {
      const fields: Record<string, string> = {};
      if (!this.fullName.trim()) fields['fullName'] = 'Họ tên không được trống.';
      if (!this.studentCode.trim()) fields['studentCode'] = 'MSSV không được trống.';
      if (new TextEncoder().encode(this.password).length > 72) fields['password'] = 'Mật khẩu tối đa 72 byte UTF-8.';
      if (!Number.isInteger(this.studyYear)) fields['studyYear'] = 'Năm học phải là số nguyên.';
      if (Object.keys(fields).length) {
        this.fields.set(fields);
        return;
      }
    }

    this.busy.set(true);
    try {
      if (this.signup) {
        await this.api.request('/auth/register', 'POST', {
          fullName: this.fullName.trim(),
          email: this.email,
          password: this.password,
          studentCode: this.studentCode.trim(),
          departmentId: this.departmentId,
          studyYear: this.studyYear,
        });
        const email = this.email;
        this.signup = false;
        this.password = '';
        form.resetForm({ email, password: '' });
        this.message.set('Tạo tài khoản thành công. Bạn có thể đăng nhập.');
      } else {
        await this.api.login(this.email, this.password);
        this.password = '';
      }
    } catch (e) {
      if (e instanceof ApiError) this.fields.set(e.fields);
      this.message.set(e instanceof Error ? e.message : 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      this.busy.set(false);
    }
  }

  private loadDepartments(): void {
    this.api
      .request<Catalog[]>('/catalog/departments')
      .then((x) => this.departments.set(x))
      .catch(() => this.message.set('Không tải được danh mục khoa. Vui lòng tải lại trang.'));
  }
}
