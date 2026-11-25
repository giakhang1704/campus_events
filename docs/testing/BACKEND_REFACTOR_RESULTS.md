# Kiểm chứng refactor backend — 12/11/2026

Nhánh: `refactor/i2-backend-layered`, tạo từ main `4cc5d6f`. Logo/tên BKevent đã commit riêng ở `7ad4b50`; refactor không thay frontend, database/schema hoặc hợp đồng API I1.

## Thay đổi

- Package theo tầng: controller, service/impl, repository/jdbc, dto, model, mapper, validation, security, exception, config.
- 6 service interface + implementation và 7 repository interface + implementation JDBC. Controller không gọi repository; service không viết SQL hoặc lấy JdbcTemplate từ repository.
- Tách user/session/account history khỏi AccountRepository cũ; chuyển SQL seed và health về repository. Transaction tiếp tục đặt ở service; các thao tác cập nhật/thu hồi phiên/audit cùng commit hoặc rollback.
- Tách request/response DTO và mapping dữ liệu công khai. User/password hash là dữ liệu nội bộ; không được đưa vào response hoặc audit JSON.
- Tách SessionAuthenticationFilter, SessionCookieManager, SessionTokenManager, PasswordValidator khỏi các lớp trước đây; giữ nguyên cookie/CSRF/BCrypt và API error contract.
- EventRequest chuyển thành EventContent nội bộ trước khi xử lý; JDBC repository không phụ thuộc request HTTP. Giữ ownership/version/row lock, đọc eligibility theo lô và REPEATABLE_READ cho published reads.
- Test chuyển sang package service/impl và validation; fixture dùng chung trong support. Tài liệu: backend/README.md và docs/architecture/ARCHITECTURE.md.

## Kết quả đã chạy

1. `mvn -f backend/pom.xml clean test`: PASS trên máy local. 17 test, 0 failures/errors/skipped; EventReadServiceTest 6, EventServiceTest 5, EventRulesTest 6. Clean loại bỏ class cũ sau khi đổi package.
2. Docker Java 21 `mvn package`: PASS, không skip test. Bản build local sau cùng cũng chạy đủ 17 test ở package mới.
3. `./scripts/test-i1.ps1`: PASS, PostgreSQL thật trong project campus-events-i1-test, database tmpfs riêng. Không dùng/reset volume phát triển. Bộ HTTP kiểm tra:
   - Auth/register/duplicate email/MSSV rollback, validation, khóa, forced password, CSRF/RBAC và vai trò cố định.
   - Thu hồi phiên, logout/replay/expiry, phiên hợp lệ qua backend restart; bootstrap/seed idempotent, không ghi đè mật khẩu đã đổi.
   - Không tự khóa, bảo vệ Admin cuối cùng khi hai yêu cầu quản trị chạy đồng thời; version và audit không chứa dữ liệu xác thực.
   - Organizer tạo/sửa/công bố, ownership, giả organizer/status, validation, restrictions nguyên tử, PostgreSQL persistence, concurrent version conflict và chặn thay đổi cần thông báo/FIFO chưa triển khai.
   - Published discovery, literal/Unicode search, phân trang ổn định, detail đầy đủ, nháp/404, tham số sai và không thay dữ liệu khi đọc.
4. `docker compose up --build -d backend frontend` và `./scripts/smoke/local.ps1`: PASS. Frontend HTTP 200, API UP, schema campus 15 bảng. Dữ liệu dev giữ nguyên; app ở http://localhost:4200.
5. Kiểm tra package/path và dependency source: PASS; không còn JdbcTemplate/SQL hoặc implementation JDBC được gọi từ controller/service; git diff --check PASS.

Không chạy lại browser regression trong lượt refactor này vì không thay frontend; HTTP tests kiểm chứng backend API. Kết quả chưa thay review độc lập hoặc nghiệm thu I1/CP1. Chưa bổ sung chức năng I2 registration/QR và chưa deploy Render/Neon.
