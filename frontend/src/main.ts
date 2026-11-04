import { Component, effect, inject, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Api } from './app/core/api';
import { AuthComponent } from './app/features/auth/auth.component';
import { AccountsComponent } from './app/features/admin/accounts.component';
import { OrganizerEventsComponent } from './app/features/events/organizer-events.component';
@Component({selector:'app-root',standalone:true,imports:[FormsModule,AuthComponent,AccountsComponent,OrganizerEventsComponent],template:`
<header><a class="brand" href="/">✦ Campus Events</a><nav><button class="secondary" (click)="preview=false">Tài khoản</button><button class="secondary" (click)="preview=true">Xem mockup</button><button class="secondary" (click)="check()">Kiểm tra kết nối</button>@if(api.user()){<button (click)="logout()">Đăng xuất</button>}</nav></header>
<main>@if(message()){<p class="notice" role="status">{{message()}}</p>}
@if(preview){<aside class="notice">Đây là mockup localStorage. Màn hình tài khoản và quản lý sự kiện của Người tổ chức bên ngoài khung gọi API thật. Các chức năng trong khung vẫn mô phỏng.</aside><iframe src="mockup/index.html" title="Mockup Campus Events"></iframe>}
@else if(loading()){<section class="panel">Đang kiểm tra phiên đăng nhập…</section>}
@else if(!api.user()){<app-auth/>}
@else{<div class="profile"><span>Xin chào, <strong>{{api.user()?.fullName}}</strong></span><span>{{api.user()?.email}}</span></div>
@if(api.user()?.mustChangePassword){<section class="panel narrow"><h1>Đổi mật khẩu lần đầu</h1><p>Bạn cần đổi mật khẩu tạm trước khi tiếp tục.</p><form (ngSubmit)="password()"><label>Mật khẩu hiện tại<input type="password" name="old" [(ngModel)]="oldPassword" required autocomplete="current-password"></label><label>Mật khẩu mới<input type="password" name="new" [(ngModel)]="newPassword" required minlength="8" maxlength="72" autocomplete="new-password"></label><button [disabled]="busy()">Đổi mật khẩu</button></form></section>}
@else if(api.user()?.role==='ADMIN'){<app-accounts/>}
@else if(api.user()?.role==='ORGANIZER'){<section class="panel"><h1>Tài khoản của bạn</h1><p>Vai trò: Người tổ chức</p></section><app-organizer-events/>}
@else{<section class="panel"><h1>Tài khoản của bạn</h1><p>Vai trò: {{api.user()?.role==='STUDENT'?'Sinh viên':'Người tổ chức'}}</p><p>{{api.user()?.studentCode?'MSSV: '+api.user()?.studentCode:''}}</p><p>Đăng nhập và phân quyền đã kết nối database. Các màn hình sự kiện sẽ được triển khai trong A05.2.</p></section>}}
</main>`})
class App {
 api=inject(Api);preview=false;loading=signal(true);busy=signal(false);message=signal('');oldPassword='';newPassword='';
 constructor(){effect(()=>{if(this.api.user())this.message.set('');});this.api.refresh().catch(e=>this.message.set(e instanceof Error?e.message:'Dịch vụ tạm thời gián đoạn. Vui lòng thử lại.')).finally(()=>this.loading.set(false));}
 async check(){try{const result=await this.api.request<{status:string;tables:number}>('/health');this.message.set('Kết nối '+result.status+' · PostgreSQL có '+result.tables+' bảng.');}catch{this.message.set('Chưa kết nối được backend/database.');}}
 async logout(){try{await this.api.logout();this.message.set('Đã đăng xuất.');}catch(e){this.message.set(e instanceof Error?e.message:'Không đăng xuất được.');}}
 async password(){this.busy.set(true);try{await this.api.request('/auth/password','POST',{currentPassword:this.oldPassword,newPassword:this.newPassword});this.api.user.set(null);this.oldPassword='';this.newPassword='';this.message.set('Đã đổi mật khẩu và thu hồi các phiên cũ. Vui lòng đăng nhập lại.');}catch(e){this.message.set(e instanceof Error?e.message:'Không đổi được mật khẩu.');}finally{this.busy.set(false);}}
}
bootstrapApplication(App).catch(console.error);
