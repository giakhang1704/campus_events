# Spring Boot 3.5.7 / Java 21 / Maven

Từ thư mục backend, đặt DB_URL, DB_USER, DB_PASSWORD trong môi trường rồi chạy mvn spring-boot:run. Java local 24 có thể dùng để build target 21; Docker dùng Java 21. Không tự đọc .env: Docker Compose nạp .env và truyền environment; chạy trực tiếp phải đặt biến PowerShell.

GET /api/health kiểm tra schema campus và truy vấn bảng events; 200 UP khi có 15 bảng, 503 khi lỗi/chưa đủ schema. Đã có API auth/admin/catalog I1, xem docs/api/I1.md từ root. Cookie HttpOnly + CSRF, BCrypt, phiên trong auth_sessions; khởi động lại backend không mất phiên hợp lệ. Chỉ bind localhost khi phát triển. DDL quản lý ở database/schema, không tự chạy khi backend khởi động.

Seed/bootstrap opt-in: xem database/seeds/README.md từ root. API sự kiện chưa triển khai.
