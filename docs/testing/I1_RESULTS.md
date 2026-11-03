# Kết quả task 1 và A05.1 — 03/11/2026

## Đã chạy đạt
- Backend build Java 21 trong Docker, frontend build Angular 21 bằng npm ci trên Linux. Lockfile đã được cập nhật tương thích cài sạch.
- scripts/test-i1.ps1: PASS. Dùng PostgreSQL 17 thật, database tmpfs của project campus-events-i1-test, API 18080; không dùng volume local.
- HTTP: bootstrap Admin, seed, đăng ký/canonical email/MSSV, rollback khi trùng MSSV, chống gửi role ADMIN qua đăng ký, mật khẩu/khoa sai, login đúng/sai/khóa, CSRF, quyền STUDENT/ORGANIZER/ADMIN, cookie HttpOnly, me/logout/replay/hết hạn.
- Admin: list/search/pagination, tạo organizer và đổi mật khẩu bắt buộc, phiên cũ bị thu hồi, khóa/mở/đổi vai trò, version cũ, thiếu lý do/vai trò sai/thiếu đơn vị/hồ sơ, organizer còn sự kiện, tự sửa quyền.
- Hai Admin đồng thời khóa nhau: đúng một thay đổi thành công, luôn còn một Admin ACTIVE. Actor được kiểm tra lại trong transaction đã serialize.
- Seed/bootstrap chạy lại sau restart: không tăng số user/event, không ghi đè mật khẩu đã đổi; phiên có trước restart vẫn dùng được.
- Snapshot audit không chứa password_hash/token/password rõ; mật khẩu DB là BCrypt cost 12.
- scripts/smoke/i1_ui.cjs qua Edge headless: PASS. Login sai/đúng, reload, tìm kiếm/rỗng, tạo/khóa/mở/đổi vai trò, đổi mật khẩu tạm, profile organizer, đăng ký/login/profile sinh viên, logout và mobile không tràn ngang.
- Đã xem ảnh admin desktop và màn đăng nhập mobile. Ảnh nằm trong frontend/.angular (không commit).
- Smoke local: frontend -> Nginx -> API -> PostgreSQL PASS, 15 bảng. Múi giờ Asia/Ho_Chi_Minh.

## Tái kiểm tra
```powershell
# Root repository, Docker Desktop đang chạy; Python cần cho HTTP integration tests.
.\scripts\test-i1.ps1
.\scripts\smoke\local.ps1
```

Browser test tùy chọn cần Playwright ở thư mục tạm và Microsoft Edge đã cài:
```powershell
npm.cmd install --prefix "$env:TEMP/campus-i1-ui" --no-audit --no-fund playwright
node .\scripts\smoke\i1_ui.cjs "$env:TEMP/campus-i1-ui/node_modules/playwright"
```
Browser test dùng localhost và dữ liệu seed trong .env; tạo tài khoản giả lập có nhãn UI, không xóa dữ liệu cũ. HTTP integration dùng DB riêng và reset chỉ DB kiểm thử tmpfs mỗi lần chạy.

## Chưa xác minh / còn việc
- Review độc lập theo báo cáo 1.7.2; không tự approve hoặc merge nhánh.
- A05.2 sự kiện thật, full A06/CP1, RA06/demo khách hàng chưa hoàn thành.
- Chưa triển khai cloud/Neon hoặc kiểm thử cross-origin. Local dùng cùng origin; cloud khác host phải có proxy/CORS/cookie được thiết kế và kiểm thử riêng.
- Không khẳng định an toàn/sẵn sàng production chỉ từ các ca trên. Không có email thật hoặc xác minh danh tính trường trong I1.

## Các lỗi đã sửa khi kiểm thử
- JdbcTemplate qua field bean proxy được thay bằng method repository để tránh field không khởi tạo trên proxy.
- Lockfile optional dependency trên Linux đã đồng bộ bằng npm trong container.
- Client lấy CSRF mới trước thao tác ghi, tránh token cũ sau thay đổi trạng thái đăng nhập.
- Select khoa/đơn vị/vai trò có aria-label rõ để thao tác bằng công cụ hỗ trợ.
