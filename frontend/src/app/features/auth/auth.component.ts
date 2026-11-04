import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Api, ApiError, Catalog } from '../../core/api';
@Component({selector:'app-auth',standalone:true,imports:[FormsModule],template:`
<section class="auth-layout"><div class="auth-intro"><span class="eyebrow">CAMPUS EVENTS</span><h1>Những trải nghiệm<br>bắt đầu từ đây.</h1><p>Tài khoản thật, dữ liệu được lưu trong hệ thống.</p></div>
<div class="panel auth-form"><h2>{{signup?'Tạo tài khoản sinh viên':'Đăng nhập'}}</h2><p class="muted">{{signup?'Khai báo hồ sơ để bắt đầu.':'Sử dụng tài khoản được cấp hoặc tự đăng ký sinh viên.'}}</p>
<form #form="ngForm" (ngSubmit)="submit(form)">
@if(signup){
<label>Họ và tên<input aria-label="Họ và tên" name="fullName" [(ngModel)]="fullName" required maxlength="150" autocomplete="name" [attr.aria-invalid]="!!error('fullName',form)" aria-describedby="fullName-error">@if(error('fullName',form)){<small class="field-error" id="fullName-error">{{error('fullName',form)}}</small>}</label>
<label>Mã số sinh viên<input aria-label="Mã số sinh viên" name="studentCode" [(ngModel)]="studentCode" required maxlength="30" [attr.aria-invalid]="!!error('studentCode',form)" aria-describedby="studentCode-error">@if(error('studentCode',form)){<small class="field-error" id="studentCode-error">{{error('studentCode',form)}}</small>}</label>}
<label>Email<input type="email" email aria-label="Email" name="email" [(ngModel)]="email" required maxlength="254" autocomplete="username" [attr.aria-invalid]="!!error('email',form)" aria-describedby="email-error">@if(error('email',form)){<small class="field-error" id="email-error">{{error('email',form)}}</small>}</label>
<label>Mật khẩu<input type="password" aria-label="Mật khẩu" name="password" [(ngModel)]="password" required [minlength]="signup?8:1" maxlength="72" [autocomplete]="signup?'new-password':'current-password'" [attr.aria-invalid]="!!error('password',form)" aria-describedby="password-error">@if(error('password',form)){<small class="field-error" id="password-error">{{error('password',form)}}</small>}</label>
@if(signup){<div class="columns">
<label>Khoa<select aria-label="Khoa" name="departmentId" [(ngModel)]="departmentId" required [attr.aria-invalid]="!!error('departmentId',form)" aria-describedby="departmentId-error"><option [ngValue]="null">Chọn khoa</option>@for(d of departments();track d.id){<option [ngValue]="d.id">{{d.name}}</option>}</select>@if(error('departmentId',form)){<small class="field-error" id="departmentId-error">{{error('departmentId',form)}}</small>}</label>
<label>Năm học<input type="number" aria-label="Năm học" name="studyYear" [(ngModel)]="studyYear" required min="1" max="32767" step="1" [attr.aria-invalid]="!!error('studyYear',form)" aria-describedby="studyYear-error">@if(error('studyYear',form)){<small class="field-error" id="studyYear-error">{{error('studyYear',form)}}</small>}</label></div>}
@if(message()){<p class="notice" role="status">{{message()}}</p>}
<button type="submit" [disabled]="busy()">{{busy()?'Đang xử lý…':signup?'Tạo tài khoản':'Đăng nhập'}}</button>
</form><button class="secondary" [disabled]="busy()" (click)="toggle(form)">{{signup?'Đã có tài khoản? Đăng nhập':'Đăng ký tài khoản sinh viên'}}</button>
</div></section>`})
export class AuthComponent {
 api=inject(Api);signup=false;email='';password='';fullName='';studentCode='';departmentId:number|null=null;studyYear=1;departments=signal<Catalog[]>([]);busy=signal(false);message=signal('');fields=signal<Record<string,string>>({});
 constructor(){this.loadDepartments();}
 private loadDepartments(){this.api.request<Catalog[]>('/catalog/departments').then(x=>this.departments.set(x)).catch(()=>this.message.set('Không tải được danh mục khoa. Vui lòng tải lại trang.'));}
 error(name:string,form:NgForm){
  if(this.fields()[name])return this.fields()[name];
  const control=form.controls[name];
  if(!form.submitted||!control?.invalid)return '';
  if(control.hasError('required'))return 'Vui lòng nhập hoặc chọn thông tin này.';
  if(control.hasError('email'))return 'Email không đúng định dạng.';
  if(control.hasError('minlength'))return 'Mật khẩu cần ít nhất 8 ký tự.';
  return 'Giá trị không hợp lệ.';
 }
 toggle(form:NgForm){this.signup=!this.signup;this.password='';this.fields.set({});this.message.set('');form.resetForm({email:this.email,studyYear:1});if(this.signup&&!this.departments().length)this.loadDepartments();}
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
    await this.api.request('/auth/register','POST',{fullName:this.fullName,email:this.email,password:this.password,studentCode:this.studentCode,departmentId:this.departmentId,studyYear:this.studyYear});
    const email=this.email;this.signup=false;this.password='';form.resetForm({email,password:''});this.message.set('Tạo tài khoản thành công. Bạn có thể đăng nhập.');
   }else{await this.api.login(this.email,this.password);this.password='';}
  }catch(e){if(e instanceof ApiError)this.fields.set(e.fields);this.message.set(e instanceof Error?e.message:'Có lỗi xảy ra. Vui lòng thử lại.');}finally{this.busy.set(false);}
 }
}
