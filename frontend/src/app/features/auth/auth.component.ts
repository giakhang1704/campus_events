import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Catalog } from '../../core/api';
@Component({selector:'app-auth',standalone:true,imports:[FormsModule],template:`
<section class="auth-layout"><div class="auth-intro"><span class="eyebrow">CAMPUS EVENTS</span><h1>Những trải nghiệm<br>bắt đầu từ đây.</h1><p>Tài khoản thật, dữ liệu được lưu trong hệ thống.</p></div>
<div class="panel auth-form"><h2>{{signup?'Tạo tài khoản sinh viên':'Đăng nhập'}}</h2><p class="muted">{{signup?'Khai báo hồ sơ để bắt đầu.':'Sử dụng tài khoản được cấp hoặc tự đăng ký sinh viên.'}}</p>
<form (ngSubmit)="submit()">
@if(signup){<label>Họ và tên<input name="fullName" [(ngModel)]="fullName" required maxlength="150" autocomplete="name"></label><label>Mã số sinh viên<input name="studentCode" [(ngModel)]="studentCode" required maxlength="30"></label>}
<label>Email<input type="email" name="email" [(ngModel)]="email" required maxlength="254" autocomplete="username"></label>
<label>Mật khẩu<input type="password" name="password" [(ngModel)]="password" required [minlength]="signup?8:1" maxlength="72" [autocomplete]="signup?'new-password':'current-password'"></label>
@if(signup){<div class="columns"><label>Khoa<select aria-label="Khoa" name="department" [(ngModel)]="departmentId" required><option [ngValue]="null">Chọn khoa</option>@for(d of departments();track d.id){<option [ngValue]="d.id">{{d.name}}</option>}</select></label><label>Năm học<input type="number" name="year" [(ngModel)]="studyYear" required min="1" max="32767" step="1"></label></div>}
@if(message()){<p class="notice" role="status">{{message()}}</p>}
<button type="submit" [disabled]="busy()">{{busy()?'Đang xử lý…':signup?'Tạo tài khoản':'Đăng nhập'}}</button>
</form><button class="secondary" (click)="signup=!signup;message.set('')">{{signup?'Đã có tài khoản? Đăng nhập':'Đăng ký tài khoản sinh viên'}}</button>
</div></section>`})
export class AuthComponent {
 api=inject(Api);signup=false;email='';password='';fullName='';studentCode='';departmentId:number|null=null;studyYear=1;departments=signal<Catalog[]>([]);busy=signal(false);message=signal('');
 constructor(){this.api.request<Catalog[]>('/catalog/departments').then(x=>this.departments.set(x)).catch(()=>this.message.set('Không tải được danh mục khoa.'));}
 async submit(){this.busy.set(true);this.message.set('');try{if(this.signup){await this.api.request('/auth/register','POST',{fullName:this.fullName,email:this.email,password:this.password,studentCode:this.studentCode,departmentId:this.departmentId,studyYear:this.studyYear});this.signup=false;this.password='';this.message.set('Tạo tài khoản thành công. Bạn có thể đăng nhập.');}else{await this.api.login(this.email,this.password);this.password='';}}catch(e){this.message.set(e instanceof Error?e.message:'Có lỗi xảy ra.');}finally{this.busy.set(false);}}
}
