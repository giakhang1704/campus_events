import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Api, ApiError, Catalog } from '../../core/api';
import { IconComponent } from '../../shared/icon/icon.component';
@Component({selector:'app-auth',standalone:true,imports:[FormsModule,IconComponent],template:`
<section class="auth-shell"><div class="auth-art"><div class="brand"><span class="brand-mark">ce</span><span>campus<em>events</em></span></div><div><p class="auth-statement">Những trải nghiệm bắt đầu từ đây.</p><p>Khám phá hội thảo, workshop và hoạt động ngoại khóa; đăng ký và điểm danh trong cùng một nơi.</p></div><small>© Campus Events</small></div>
<div class="auth-content"><div class="auth-box"><h1>{{signup?'Tạo tài khoản sinh viên':'Đăng nhập'}}</h1><p>{{signup?'Khai báo hồ sơ để bắt đầu tham gia sự kiện.':'Sử dụng tài khoản được cấp hoặc tài khoản sinh viên đã đăng ký.'}}</p>
<form #form="ngForm" (ngSubmit)="submit(form)">
@if(signup){
<label>Họ và tên<input aria-label="Họ và tên" name="fullName" [(ngModel)]="fullName" required maxlength="150" autocomplete="name" [attr.aria-invalid]="!!error('fullName',form)" aria-describedby="fullName-error">@if(error('fullName',form)){<small class="field-error" id="fullName-error">{{error('fullName',form)}}</small>}</label>
<label>Mã số sinh viên<input aria-label="Mã số sinh viên" name="studentCode" [(ngModel)]="studentCode" required maxlength="30" [attr.aria-invalid]="!!error('studentCode',form)" aria-describedby="studentCode-error">@if(error('studentCode',form)){<small class="field-error" id="studentCode-error">{{error('studentCode',form)}}</small>}</label>}
<label>Email<input type="email" email aria-label="Email" name="email" [(ngModel)]="email" required maxlength="254" autocomplete="username" [attr.aria-invalid]="!!error('email',form)" aria-describedby="email-error">@if(error('email',form)){<small class="field-error" id="email-error">{{error('email',form)}}</small>}</label>
<label>Mật khẩu<span class="password-field"><input [type]="showPassword()?'text':'password'" aria-label="Mật khẩu" name="password" [(ngModel)]="password" required [minlength]="signup?8:1" maxlength="72" [autocomplete]="signup?'new-password':'current-password'" [attr.aria-invalid]="!!error('password',form)" aria-describedby="password-error"><button type="button" class="pw-toggle" [attr.aria-label]="showPassword()?'Ẩn mật khẩu':'Hiện mật khẩu'" [attr.aria-pressed]="showPassword()" (click)="showPassword.set(!showPassword())"><app-icon [name]="showPassword()?'eye-off':'eye'"/></button></span>@if(error('password',form)){<small class="field-error" id="password-error">{{error('password',form)}}</small>}</label>
@if(signup){<div class="columns">
<label>Khoa<select aria-label="Khoa" name="departmentId" [(ngModel)]="departmentId" required [attr.aria-invalid]="!!error('departmentId',form)" aria-describedby="departmentId-error"><option [ngValue]="null">Chọn khoa</option>@for(d of departments();track d.id){<option [ngValue]="d.id">{{d.name}}</option>}</select>@if(error('departmentId',form)){<small class="field-error" id="departmentId-error">{{error('departmentId',form)}}</small>}</label>
<label>Năm học<input type="number" aria-label="Năm học" name="studyYear" [(ngModel)]="studyYear" required min="1" max="32767" step="1" [attr.aria-invalid]="!!error('studyYear',form)" aria-describedby="studyYear-error">@if(error('studyYear',form)){<small class="field-error" id="studyYear-error">{{error('studyYear',form)}}</small>}</label></div>}
@if(message()){<p class="notice" [class.success]="message().startsWith('Tạo tài khoản thành công')" role="status">{{message()}}</p>}
<button type="submit" [disabled]="busy()">{{busy()?'Đang xử lý…':signup?'Tạo tài khoản':'Đăng nhập'}}</button>
</form><p class="auth-switch"><button type="button" class="link" [disabled]="busy()" (click)="toggle(form)">{{signup?'Đã có tài khoản? Đăng nhập':'Đăng ký tài khoản sinh viên'}}</button></p>
</div></div></section>`})
export class AuthComponent {
 api=inject(Api);signup=false;email='';password='';fullName='';studentCode='';departmentId:number|null=null;studyYear=1;departments=signal<Catalog[]>([]);busy=signal(false);showPassword=signal(false);message=signal('');fields=signal<Record<string,string>>({});
 // Messages from other screens (logout, password change, session check) arrive as toasts (ToastService).
 // Departments are only needed for sign-up; toggle() loads them on demand.
 /** Field-specific wording for empty required fields. */
 private static readonly REQUIRED:Record<string,string>={email:'Vui lòng nhập email.',password:'Vui lòng nhập mật khẩu.',fullName:'Vui lòng nhập họ và tên.',studentCode:'Vui lòng nhập mã số sinh viên.',departmentId:'Vui lòng chọn khoa.',studyYear:'Vui lòng nhập năm học.'};
 private loadDepartments(){this.api.request<Catalog[]>('/catalog/departments').then(x=>this.departments.set(x)).catch(()=>this.message.set('Không tải được danh mục khoa. Vui lòng tải lại trang.'));}
 error(name:string,form:NgForm){
  if(this.fields()[name])return this.fields()[name];
  const control=form.controls[name];
  // Shown once the user leaves the field (touched) or submits.
  if(!control?.invalid||!(form.submitted||control.touched))return '';
  if(control.hasError('required'))return AuthComponent.REQUIRED[name]??'Vui lòng nhập hoặc chọn thông tin này.';
  if(control.hasError('email'))return 'Email không hợp lệ.';
  if(control.hasError('minlength'))return 'Mật khẩu cần ít nhất 8 ký tự.';
  return 'Giá trị không hợp lệ.';
 }
 toggle(form:NgForm){this.signup=!this.signup;this.showPassword.set(false);this.password='';this.fields.set({});this.message.set('');form.resetForm({email:this.email,studyYear:1});if(this.signup&&!this.departments().length)this.loadDepartments();}
 async submit(form:NgForm){
  if(this.busy())return;
  this.fields.set({});this.message.set('');
  if(form.invalid){form.control.markAllAsTouched();this.message.set('Vui lòng kiểm tra các trường được đánh dấu.');return;}
  if(this.signup){
   const fields:Record<string,string>={};
   if(!this.fullName.trim())fields['fullName']='Họ tên không được trống.';
   if(!this.studentCode.trim())fields['studentCode']='MSSV không được trống.';
   if(new TextEncoder().encode(this.password).length>72)fields['password']='Mật khẩu tối đa 72 byte UTF-8.';
   if(!Number.isInteger(this.studyYear))fields['studyYear']='Năm học phải là số nguyên.';
   if(Object.keys(fields).length){this.fields.set(fields);return;}
  }
  this.busy.set(true);
  try{
   if(this.signup){
    await this.api.request('/auth/register','POST',{fullName:this.fullName.trim(),email:this.email,password:this.password,studentCode:this.studentCode.trim(),departmentId:this.departmentId,studyYear:this.studyYear});
    const email=this.email;this.signup=false;this.password='';form.resetForm({email,password:''});this.message.set('Tạo tài khoản thành công. Bạn có thể đăng nhập.');
   }else{await this.api.login(this.email,this.password);this.password='';}
  }catch(e){if(e instanceof ApiError)this.fields.set(e.fields);this.message.set(e instanceof Error?e.message:'Có lỗi xảy ra. Vui lòng thử lại.');}finally{this.busy.set(false);}
 }
}
