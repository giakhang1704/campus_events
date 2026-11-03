import { Injectable, signal } from '@angular/core';
export interface User {id:number;fullName:string;email:string;role:string;status:string;mustChangePassword:boolean;version:number;organizationUnitId:number|null;studentCode:string|null;departmentId:number|null;studyYear:number|null;}
export interface Catalog {id:number;name:string;code?:string;}
export class ApiError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
@Injectable({providedIn:'root'})
export class Api {
 user=signal<User|null>(null);private csrfToken='';
 async request<T>(path:string,method='GET',body?:unknown):Promise<T>{
  if(!['GET','HEAD'].includes(method) ){const token=await this.request<{token:string}>('/auth/csrf');this.csrfToken=token.token;}
  const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(!['GET','HEAD'].includes(method)?{'X-XSRF-TOKEN':this.csrfToken}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok){const error=await response.json().catch(()=>({}));if(response.status===401)this.user.set(null);throw new ApiError(response.status,error.code||'REQUEST_FAILED',error.message||'Không thực hiện được yêu cầu.');}
  return response.status===204?undefined as T:response.json();
 }
 async refresh(){try{this.user.set(await this.request<User>('/auth/me'));}catch(error){if(!(error instanceof ApiError)||error.status!==401)throw error;}}
 async login(email:string,password:string){this.user.set(await this.request<User>('/auth/login','POST',{email,password}));}
 async logout(){await this.request('/auth/logout','POST');this.user.set(null);}
}
