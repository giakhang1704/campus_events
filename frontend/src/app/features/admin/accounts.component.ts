import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Api, ApiError, User, Catalog } from '../../core/api';
interface ChangePreview {before:User;role:string;status:string;organizationUnitId:number|null;reason:string;changed:boolean;impact:string;}
interface OrganizerRequest {fullName:string;email:string;temporaryPassword:string;organizationUnitId:number|null;reason:string;}
@Component({selector:'app-accounts',standalone:true,imports:[FormsModule],template:`
<div class="section-title"><div><h1>Quản lý tài khoản</h1><p class="muted">Tra cứu, cấp tài khoản và khóa/mở quyền truy cập. Mỗi tài khoản có một vai trò cố định.</p></div><button [disabled]="busy()" (click)="toggleCreate()">{{creating?'Đóng form':'Cấp tài khoản người tổ chức'}}</button></div>
@if(message()){<p class="notice" role="status">{{message()}}</p>}
@if(creating){<section class="panel"><h2>Cấp tài khoản người tổ chức</h2>
@if(createReview){
<h3>Xác nhận cấp tài khoản</h3><p>{{createReview.fullName}} · {{createReview.email}}</p><p>Vai trò: Người tổ chức · Đơn vị: {{unitLabel(createReview.organizationUnitId)}}</p><p>Lý do: {{createReview.reason}}</p><p>Chỉ cấp cho người đã được phân công và đối chiếu thông tin. Bàn giao mật khẩu tạm riêng cho đúng người; người nhận phải đổi mật khẩu khi đăng nhập lần đầu. Không công khai mật khẩu trong danh sách tài khoản.</p><button [disabled]="busy()" (click)="create()">Xác nhận cấp tài khoản</button><button class="secondary" [disabled]="busy()" (click)="createReview=null">Quay lại</button><button class="secondary" [disabled]="busy()" (click)="cancelCreate()">Hủy</button>
}@else{
<form #createForm="ngForm" (ngSubmit)="reviewCreate(createForm)"><div class="columns">
<label>Họ tên<input name="name" [(ngModel)]="name" required maxlength="150">@if(fields()['fullName']){<small class="field-error">{{fields()['fullName']}}</small>}</label>
<label>Email<input type="email" email name="email" [(ngModel)]="email" required maxlength="254">@if(fields()['email']){<small class="field-error">{{fields()['email']}}</small>}</label>
<label>Mật khẩu tạm<input type="password" name="temporary" [(ngModel)]="temporary" required minlength="8" maxlength="72" autocomplete="new-password">@if(fields()['temporaryPassword']){<small class="field-error">{{fields()['temporaryPassword']}}</small>}</label>
<label>Đơn vị<select aria-label="Đơn vị" name="unit" [(ngModel)]="unit" required><option [ngValue]="null">Chọn đơn vị</option>@for(d of units();track d.id){<option [ngValue]="d.id">{{d.name}}</option>}</select>@if(fields()['organizationUnitId']){<small class="field-error">{{fields()['organizationUnitId']}}</small>}</label></div>
<label>Lý do<textarea name="createReason" [(ngModel)]="createReason" required maxlength="1000"></textarea>@if(fields()['reason']){<small class="field-error">{{fields()['reason']}}</small>}</label><p class="muted">Tài khoản sinh viên được tự đăng ký. Nếu email đã tồn tại, hãy tra cứu hoặc liên hệ người phụ trách. Không thể đổi vai trò của tài khoản đã tạo.</p><button [disabled]="busy()">Tạo tài khoản</button><button type="button" class="secondary" (click)="cancelCreate()">Hủy</button></form>}
</section>}
@if(selected){<section class="panel"><h2>Đổi trạng thái · {{selected.fullName}}</h2>
@if(preview){
<h3>Xác nhận thay đổi tài khoản</h3><p>{{preview.before.fullName}} · {{preview.before.email}} {{preview.before.studentCode||''}}</p>
<p>Vai trò cố định: {{roleLabel(preview.before.role)}}</p><p>Trạng thái: {{statusLabel(preview.before.status)}} → {{statusLabel(preview.status)}}</p><p>Đơn vị: {{unitLabel(preview.before.organizationUnitId)}}</p><p>Lý do: {{preview.reason}}</p><p class="notice">{{preview.impact}}</p><button [disabled]="busy()" (click)="confirmSave()">Xác nhận lưu</button><button class="secondary" [disabled]="busy()" (click)="preview=null">Quay lại</button><button class="secondary" [disabled]="busy()" (click)="cancelEdit()">Hủy</button>
}@else{
<p>{{selected.email}} · Vai trò hiện tại: {{roleLabel(selected.role)}} · Trạng thái: {{statusLabel(selected.status)}}</p>
<form #changeForm="ngForm" (ngSubmit)="save(changeForm)"><p>Chuyển sang: <strong>{{selected.status==='ACTIVE'?'Khóa':'Hoạt động'}}</strong></p>
<label>Lý do<textarea name="reason" [(ngModel)]="reason" required maxlength="1000"></textarea></label><button [disabled]="busy()">Lưu thay đổi</button><button class="secondary" type="button" [disabled]="busy()" (click)="cancelEdit()">Hủy</button></form>}
</section>}
<section class="panel"><form class="search-row" (ngSubmit)="page=0;load()"><input name="search" aria-label="Tìm tài khoản" placeholder="Họ tên, email hoặc MSSV" [(ngModel)]="q" maxlength="100">
<select aria-label="Lọc vai trò" name="filterRole" [(ngModel)]="filterRole"><option value="">Tất cả vai trò</option><option value="STUDENT">Sinh viên</option><option value="ORGANIZER">Người tổ chức</option><option value="ADMIN">Quản trị viên</option></select>
<select aria-label="Lọc trạng thái" name="filterStatus" [(ngModel)]="filterStatus"><option value="">Tất cả trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="LOCKED">Đã khóa</option></select><button [disabled]="busy()">Tìm kiếm</button></form>
<div class="table-scroll"><table><thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>@for(u of items();track u.id){<tr><td><strong>{{u.fullName}}</strong><small>{{u.email}} {{u.studentCode||''}}</small></td><td>{{roleLabel(u.role)}}</td><td><span class="badge" [class.red]="u.status==='LOCKED'">{{statusLabel(u.status)}}</span></td><td><button class="secondary" [disabled]="u.id===api.user()?.id||busy()" (click)="edit(u)">{{u.status==='ACTIVE'?'Khóa':'Mở khóa'}}</button></td></tr>}@empty{<tr><td colspan="4">{{busy()?'Đang tải…':'Không có tài khoản phù hợp.'}}</td></tr>}</tbody></table></div><div class="pager"><button class="secondary" [disabled]="page===0||busy()" (click)="page=page-1;load()">Trước</button><span>Trang {{page+1}}</span><button class="secondary" [disabled]="!hasNext()||busy()" (click)="page=page+1;load()">Tiếp</button></div></section>`})
export class AccountsComponent {
 api=inject(Api);items=signal<User[]>([]);units=signal<Catalog[]>([]);busy=signal(false);message=signal('');fields=signal<Record<string,string>>({});hasNext=signal(false);
 q='';filterRole='';filterStatus='';page=0;creating=false;selected:User|null=null;reason='';name='';email='';temporary='';unit:number|null=null;createReason='';
 preview:ChangePreview|null=null;createReview:OrganizerRequest|null=null;
 constructor(){void this.load();this.api.request<Catalog[]>('/catalog/organization-units').then(x=>this.units.set(x)).catch(()=>this.message.set('Không tải được đơn vị. Vui lòng tải lại trang.'));}
 roleLabel(role:string){return ({STUDENT:'Sinh viên',ORGANIZER:'Người tổ chức',ADMIN:'Quản trị viên'} as Record<string,string>)[role]||role;}
 statusLabel(status:string){return status==='ACTIVE'?'Hoạt động':'Đã khóa';}
 unitLabel(id:number|null){return this.units().find(u=>u.id===id)?.name||(id===null?'Không áp dụng':String(id));}
 async load(){
  this.busy.set(true);this.message.set('');
  try{const params=new URLSearchParams({q:this.q,role:this.filterRole,status:this.filterStatus,page:String(this.page),size:'10'});const result=await this.api.request<{items:User[];hasNext:boolean}>('/admin/users?'+params);this.items.set(result.items);this.hasNext.set(result.hasNext);return true;}
  catch(e){this.items.set([]);this.hasNext.set(false);this.message.set(e instanceof Error?e.message:'Không tải được tài khoản. Vui lòng thử lại.');return false;}finally{this.busy.set(false);}
 }
 cancelEdit(){this.selected=null;this.preview=null;this.reason='';}
 cancelCreate(){this.creating=false;this.createReview=null;this.temporary='';this.fields.set({});}
 toggleCreate(){if(this.creating)this.cancelCreate();else{this.creating=true;this.cancelEdit();this.message.set('');}}
 edit(user:User){this.cancelCreate();this.selected=user;this.reason='';this.preview=null;this.message.set('');}
 async save(form:NgForm){
  if(!this.selected||this.busy())return;
  if(form.invalid||!this.reason.trim()){this.message.set('Vui lòng nhập lý do hợp lệ.');return;}
  this.busy.set(true);this.message.set('');
  try{
   const u=this.selected;
   const body={status:u.status==='ACTIVE'?'LOCKED':'ACTIVE',version:u.version,reason:this.reason.trim()};
   const result=await this.api.request<ChangePreview>('/admin/users/'+u.id+'/status/preview','POST',body);
   if(result.changed)this.preview=result;else{this.cancelEdit();this.message.set('Không có thay đổi.');}
  }catch(e){this.message.set(e instanceof Error?e.message:'Không kiểm tra được điều kiện thay đổi.');}finally{this.busy.set(false);}
 }
 async confirmSave(){
  const preview=this.preview;if(!preview||this.busy())return;
  this.busy.set(true);
  try{
   const body={status:preview.status,version:preview.before.version,reason:preview.reason};
   await this.api.request('/admin/users/'+preview.before.id+'/status','PATCH',body);
   this.cancelEdit();if(await this.load())this.message.set('Đã cập nhật tài khoản.');
  }catch(e){this.preview=null;this.message.set(e instanceof Error?e.message:'Không lưu được.');}finally{this.busy.set(false);}
 }
 reviewCreate(form:NgForm){
  this.fields.set({});this.message.set('');
  const fields:Record<string,string>={};
  if(!this.name.trim())fields['fullName']='Vui lòng nhập họ tên.';
  if(!this.email||form.controls['email']?.invalid)fields['email']='Vui lòng nhập email hợp lệ.';
  if(this.temporary.length<8||new TextEncoder().encode(this.temporary).length>72)fields['temporaryPassword']='Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.';
  if(!this.unit)fields['organizationUnitId']='Vui lòng chọn đơn vị.';
  if(!this.createReason.trim())fields['reason']='Vui lòng nhập lý do cấp quyền.';
  if(form.invalid||Object.keys(fields).length){this.fields.set(fields);this.message.set('Vui lòng kiểm tra các trường được đánh dấu.');return;}
  this.createReview={fullName:this.name.trim(),email:this.email,temporaryPassword:this.temporary,organizationUnitId:this.unit,reason:this.createReason.trim()};
 }
 async create(){
  if(!this.createReview||this.busy())return;
  this.busy.set(true);
  try{await this.api.request('/admin/users','POST',this.createReview);this.cancelCreate();if(await this.load())this.message.set('Đã cấp tài khoản; người nhận cần đổi mật khẩu.');}
  catch(e){this.createReview=null;if(e instanceof ApiError){this.fields.set({...e.fields,...(e.fields['password']?{temporaryPassword:e.fields['password']}:{})});}this.message.set(e instanceof Error?e.message:'Không tạo được tài khoản.');}finally{this.busy.set(false);}
 }
}
