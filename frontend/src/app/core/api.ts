import { Injectable, signal } from '@angular/core';
export interface User {id:number;fullName:string;email:string;role:string;status:string;mustChangePassword:boolean;version:number;organizationUnitId:number|null;studentCode:string|null;departmentId:number|null;studyYear:number|null;}
export interface Catalog {id:number;name:string;code?:string;}
export class ApiError extends Error {
 constructor(public status:number,public code:string,message:string,public fields:Record<string,string>={}){super(message);}
}
@Injectable({providedIn:'root'})
export class Api {
 user=signal<User|null>(null);
 private readonly pendingKey='campus.logoutPending';
 private logoutRequest:Promise<void>|null=null;
 private authGeneration=0;
 constructor(){
  window.addEventListener('online',()=>{if(this.logoutPending())void this.finishLogout().catch(()=>{});});
  window.addEventListener('storage',event=>{if(event.key===this.pendingKey&&event.newValue==='1'){this.authGeneration++;this.user.set(null);}});
 }
 private logoutPending(){return localStorage.getItem(this.pendingKey)==='1';}
 async request<T>(path:string,method='GET',body?:unknown):Promise<T>{
  // A pending logout must never restore access through the remaining HttpOnly cookie.
  const publicRead=method==='GET'&&['/catalog/departments','/catalog/organization-units','/health'].includes(path);
  if(this.logoutPending()&&!publicRead&&!['/auth/logout','/auth/csrf'].includes(path)){
   throw new ApiError(401,'LOGOUT_PENDING','Đã đăng xuất trên thiết bị. Vui lòng kết nối lại để hoàn tất thu hồi phiên.');
  }
  let csrfToken='';
  if(!['GET','HEAD'].includes(method))csrfToken=(await this.request<{token:string}>('/auth/csrf')).token;
  let response:Response;
  try{
   response=await fetch('/api'+path,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(!['GET','HEAD'].includes(method)?{'X-XSRF-TOKEN':csrfToken}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  }catch{throw new ApiError(0,'NETWORK_ERROR','Không kết nối được dịch vụ. Vui lòng kiểm tra mạng và thử lại.');}
  if(!response.ok){
   const error=await response.json().catch(()=>({}));
   if(response.status===401)this.user.set(null);
   throw new ApiError(response.status,error.code||'REQUEST_FAILED',error.message||'Dịch vụ tạm thời gián đoạn. Vui lòng thử lại.',error.fields||{});
  }
  return response.status===204?undefined as T:response.json();
 }
 async refresh(){
  if(this.logoutPending()){this.user.set(null);await this.finishLogout();return;}
  const generation=this.authGeneration;
  try{const user=await this.request<User>('/auth/me');if(generation===this.authGeneration&&!this.logoutPending())this.user.set(user);}catch(error){if(!(error instanceof ApiError)||error.status!==401)throw error;}
 }
 async login(email:string,password:string){if(this.logoutPending())await this.finishLogout();const generation=this.authGeneration;const user=await this.request<User>('/auth/login','POST',{email,password});if(generation===this.authGeneration&&!this.logoutPending())this.user.set(user);}
 private finishLogout():Promise<void>{
  if(!this.logoutRequest)this.logoutRequest=this.request('/auth/logout','POST').then(()=>{localStorage.removeItem(this.pendingKey);}).finally(()=>{this.logoutRequest=null;});
  return this.logoutRequest;
 }
 async logout(){
  localStorage.setItem(this.pendingKey,'1');this.authGeneration++;this.user.set(null);
  try{await this.finishLogout();}catch{
   throw new ApiError(0,'LOGOUT_PENDING','Đã đăng xuất trên thiết bị, chưa xác nhận được việc vô hiệu hóa phiên phía máy chủ. Hệ thống sẽ thử lại khi có kết nối hoặc tải lại trang; phiên máy chủ hết hiệu lực theo thời hạn 8 giờ.');
  }
 }
}
