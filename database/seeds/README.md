# Dữ liệu I1 và Admin đầu tiên

Seed qua SeedRunner của Spring Boot để hash mật khẩu bằng BCrypt; không có plaintext hoặc hash dùng chung được commit. Không xóa bảng, không reset sequence, không đổi tài khoản đã tồn tại. Seed chạy trong một transaction; bật lại không nhân bản bản ghi. Khoa theo code, đơn vị theo name; tài khoản theo email; sự kiện mẫu theo title/organizer. Nếu dữ liệu cũ xung đột MSSV hoặc FK, transaction báo lỗi thay vì âm thầm ghi đè.

## Local demo
Sau khi build stack: ./scripts/seed-local.ps1. Script chỉ bổ sung DEV_SEED_PASSWORD vào .env nếu chưa có, không in mật khẩu. Theo dõi docker compose logs backend và đợi health UP.

Các email giả lập: admin.i1@example.test, admin2.i1@example.test, organizer.i1@example.test, student.i1@example.test, locked.i1@example.test. Mật khẩu của tài khoản được tạo mới là DEV_SEED_PASSWORD trong .env; locked không đăng nhập được. Có 12 lựa chọn khoa/chương trình theo danh mục người dùng cung cấp, một đơn vị, sự kiện DRAFT/PUBLISHED tương lai. Các tài khoản seed không bị ép đổi mật khẩu vì dữ liệu local; tài khoản organizer do Admin cấp qua API thì có.

Sau khi seed xong: docker compose up -d --no-deps backend để tắt cờ seed ở lần khởi động sau, dữ liệu giữ nguyên. Frontend và database không bị reset. Không bật dev seed trên production.

## Bootstrap production/local không dùng seed
Trên backend cung cấp CAMPUS_BOOTSTRAP_ENABLED=true, CAMPUS_BOOTSTRAP_EMAIL và CAMPUS_BOOTSTRAP_PASSWORD (>=8 ký tự, <=72 byte). Runner chỉ tạo Admin nếu chưa có Admin ACTIVE; không đổi mật khẩu tài khoản hiện hữu. Tắt cờ sau khi tạo. Biến này truyền trực tiếp vào tiến trình/container, không tự lấy từ .env nếu Compose chưa khai báo. Không log hoặc commit mật khẩu. Với PostgreSQL đã có schema, không chạy lại baseline.

## Danh mục khoa

Danh mục 12 khoa/chương trình được `CatalogInitializer` đồng bộ khi backend khởi động, trước seed tài khoản và không phụ thuộc cờ dev seed. Tên/thứ tự đặt trong `catalog/DepartmentCatalog.java`; mã là khóa nội bộ, không khẳng định là mã khoa chính thức. Upsert theo code giữ nguyên id và các liên kết hồ sơ/sự kiện; không xóa dữ liệu cũ. Mã CSE được giữ và đổi tên hiển thị thành Khoa Khoa học và Kỹ thuật Máy tính. Các dòng mẫu cũ như ECON được giữ để bảo toàn lịch sử, nhưng không còn trong API lựa chọn mới. Không cần reset volume hay chạy lại baseline SQL.
