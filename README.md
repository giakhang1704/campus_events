# Campus Events — môi trường local

Bộ khung chạy được theo thiết kế: Angular 21.0.0, Spring Boot 3.5.7 (Java 21), PostgreSQL 17, Docker Compose. Đây là các phiên bản khởi tạo mới; không thay phiên bản ứng dụng cũ.

## Lấy mã nguồn và chạy local

Mở Docker Desktop và đợi engine sẵn sàng. PowerShell:

```powershell
git clone https://github.com/giakhang1704/campus_events.git
Set-Location .\campus_events
.\scripts\setup-local.ps1
docker compose up --build -d
.\scripts\smoke\local.ps1
```

Mở http://localhost:4200. Các lệnh sau khi clone đều tính từ thư mục gốc repository, không phụ thuộc đường dẫn máy cá nhân. Nếu đã clone thì mở terminal tại root và bỏ hai lệnh đầu. Khi khởi động lần đầu, đợi backend sẵn sàng trước khi chạy smoke test.

## Bắt đầu
Đọc **[hướng dẫn chạy localhost](docs/environment/LOCAL_RUN.md)**: cách tạo .env, docker compose up --build -d, truy cập http://localhost:4200, chạy dev từng phần, pgAdmin và xử lý lỗi.

## Phạm vi
- Angular hiển thị kiểm tra kết nối môi trường qua API thật /api/health. Backend truy vấn PostgreSQL thật và xác nhận 15 bảng trong schema campus.
- Giao diện nghiệp vụ được nhúng từ public/mockup; dữ liệu localStorage, đăng nhập/QR/email vẫn mô phỏng. Chưa có API nghiệp vụ.
- Schema giữ một dòng đăng ký/student/event; hủy giữ attendance, đăng ký lại tự reset có snapshot audit trong cùng transaction.
- Mockup làm việc có một lượt điểm danh, ends_at, giới hạn nhiều khoa/năm, sức chứa nguyên dương, bảo vệ Admin và CSV. Nguồn cũ giữ nguyên trong docs/references; mã thay thế được comment, không xóa.

## Cấu trúc
```text
frontend/         Angular, Dockerfile, nginx proxy; public/mockup là bản xem trước
backend/          Spring Boot, Dockerfile; module nghiệp vụ và API môi trường
database/         schema, queries, tests, migrations, seeds
deploy/           neon, vercel, lightsail
scripts/smoke/    kiểm tra HTTP và mockup
docs/             architecture, decisions, design, environment, references
compose.yaml      stack local, cổng chỉ bind 127.0.0.1
.env.example      mẫu cấu hình Compose
```

## Kiểm chứng
Xem docs/environment/SMOKE_TEST.md. Có cấu hình không đồng nghĩa đã chạy. Chưa deploy cloud, chưa xác nhận toàn bộ A03/RA02/A11.

## Nguyên tắc
Không commit secret; Compose nạp .env, Spring Boot không tự đọc .env. Schema init chỉ chạy trên volume rỗng. Không dùng down -v với dữ liệu cần giữ. Không mặc định bảng nguồn trong references là schema hiện hành.

## Trạng thái kiểm tra mới nhất
03/11/2026 22:53 giờ Việt Nam: toàn bộ stack Compose đang chạy, FE -> BE -> PostgreSQL smoke test PASS. Múi giờ backend/database: Asia/Ho_Chi_Minh (+07:00). Mở http://localhost:4200. Lần sau dùng docker compose up -d; dừng bằng docker compose down (giữ volume). Chưa có API nghiệp vụ hoàn chỉnh hoặc cloud deploy.
