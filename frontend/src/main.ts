import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
@Component({selector:'app-root',standalone:true,template:`
<header><div><strong>Campus Events</strong><p>Môi trường local · Angular → Spring Boot → PostgreSQL</p></div><button (click)="check()" [disabled]="busy()">Kiểm tra kết nối</button></header>
<section role="status"><b>{{status()}}</b><p>{{detail()}}</p></section>
<aside>Giao diện bên dưới là mockup dùng dữ liệu trên trình duyệt. Đăng ký, điểm danh và email chưa kết nối backend. Chỉ nút kiểm tra môi trường gọi API thật.</aside>
<iframe src="mockup/index.html" title="Mockup Campus Events một lượt điểm danh"></iframe>`})
class App {
 status=signal('Chưa kiểm tra'); detail=signal('Bấm Kiểm tra kết nối để xác nhận backend và schema database.');busy=signal(false);
 async check() { this.busy.set(true); try {const response=await fetch('/api/health'); const result=await response.json(); if(!response.ok || result.status!=='UP') throw new Error(); this.status.set('Kết nối thành công');this.detail.set('Backend đã truy vấn PostgreSQL; schema campus có '+result.tables+' bảng.');} catch {this.status.set('Chưa kết nối được');this.detail.set('Kiểm tra docker compose ps và logs backend/db theo README.');} finally {this.busy.set(false);} }
}
bootstrapApplication(App).catch(console.error);
