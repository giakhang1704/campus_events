# Kiểm chứng thực tế — 03/11/2026, 22:53 giờ Việt Nam

## Kết quả hiện tại
| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Docker engine | PASS | Docker 29.4.0 phản hồi sau khi bảo tồn và tạo lại thư mục socket runtime |
| Build Docker frontend/backend | PASS | Angular 21 build; Spring Boot build bằng Java 21 trong image |
| Compose toàn stack | PASS | db healthy; frontend/backend Up; không xóa volume |
| HTTP frontend | PASS | http://localhost:4200 trả 200 |
| FE proxy -> BE -> PostgreSQL | PASS | scripts/smoke/local.ps1: API UP, schema campus có 15 bảng |
| PostgreSQL thật | PASS | PostgreSQL 17.11 trong container, schema init trên volume mới |
| SQL regression | PASS | Hủy, đăng ký lại/reset, audit, rollback, cùng dòng, promotion, deadline; fixtures ROLLBACK |
| Giờ Việt Nam | PASS | SHOW TIMEZONE = Asia/Ho_Chi_Minh; now() và log backend có +07:00 |
| Backend dev trên Windows | PASS | scripts/start-backend.ps1 dùng project-local socket temp path |
| Kiểm thử mockup logic | PASS trước đó | Một lượt, ends_at, chọn nhiều khoa/năm, CSV, sức chứa và đăng ký lại |
| Kiểm tra layout bằng browser tool | Chưa xác minh | Công cụ UI/browser trước đó timeout |
| Concurrency/auth/email nghiệp vụ | Chưa triển khai/kiểm chứng | Health không chứng minh chức năng nghiệp vụ hoàn tất |
| Neon/Lightsail/Vercel deploy | Chưa thực hiện | Không tạo tài nguyên cloud |

## Cách tái kiểm tra
Từ project root: docker compose up -d; docker compose ps; ./scripts/smoke/local.ps1.
Chạy database/tests/02_registration_reset.sql theo LOCAL_RUN.md. Không cần reset hoặc seed lại DB.

## Lỗi đã xử lý
- Docker inference/secrets socket dạng reparse point cũ: dừng Desktop, bảo tồn thư mục socket bằng đổi tên, khởi động lại. Phải xử lý cả hai thư mục trong cùng lần dừng để tránh socket vừa tạo bị bỏ lại sau lần startup lỗi tiếp theo. Không factory reset, không xóa image/volume/database.
- Java Windows loopback: scripts/start-backend.ps1 đặt jdk.net.unixdomain.tmpdir vào backend/target/socket-tmp.
- JDBC gửi Asia/Saigon bị PostgreSQL từ chối: backend dùng tên chuẩn Asia/Ho_Chi_Minh; Compose cấu hình timezone và log_timezone tương ứng. Không dùng UTC làm múi giờ hiển thị vận hành.

## Cảnh báo còn lại
Docker báo tích hợp Ubuntu WSL có /var/run/docker.sock đang được dùng. Không sửa hoặc dừng Docker riêng trong Ubuntu; Docker CLI Windows và project Compose đã hoạt động. Việc tích hợp Ubuntu cần xử lý riêng nếu nhóm muốn chạy docker từ distro đó.

## Bản sao runtime giữ lại
%LOCALAPPDATA%/Docker/run.backup-20261103-224357
%LOCALAPPDATA%/Docker/run.backup-20261103-224605
%LOCALAPPDATA%/docker-secrets-engine.backup-20261103-224459

Không coi smoke test môi trường là đã hoàn thành các chức năng hoặc RA02/A11 cloud.

## Cập nhật A05.1
Task chuẩn bị và tài khoản đã có implementation/API thật, kiểm thử HTTP và browser PASS. Xem docs/testing/I1_RESULTS.md (từ root). Những ghi nhận chưa có auth/email phía trên là lịch sử môi trường trước I1; email và sự kiện A05.2 vẫn chưa triển khai.
