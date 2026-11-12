# Kết quả tự kiểm thử backend I2 — 12/11/2026

Phạm vi A07.1/A07.2/A07.3 và phần kiểm thử backend A08, đối chiếu Bảng 23/Bảng 33 trong `main (8).pdf`. Không thêm giờ vào kế hoạch. Đây là bằng chứng triển khai/tự kiểm thử; chưa thay review độc lập, tích hợp frontend hoặc biên bản CP2.

Mã kiểm tra: backend I2 trên nhánh `feature/i2-backend`, base `d5eef2e08ff3033518f79cb42241a203b93eb4f0`; mã nguồn đã kiểm thử được lưu trong cùng commit với tài liệu này. Image backend local đã chạy: `sha256:2ec7c109bad93219c710677122d6de374855ed4034257f1ed6250002b66b4830`.

## Lệnh đã chạy và kết quả

Tất cả lệnh từ root repository, giờ Việt Nam (+07:00).

| Kiểm tra | Kết quả |
| --- | --- |
| `mvn -f backend/pom.xml test` | PASS 29 test, 0 failure/error |
| `./scripts/test-i2.ps1` | PASS HTTP thật → Spring Boot → PostgreSQL 17 + HTTP mail giả lập |
| `./scripts/test-i1.ps1 -PlaywrightModule "$env:TEMP/campus-i1-ui/node_modules/playwright"` | PASS tài khoản/sự kiện/RBAC/CSRF/PostgreSQL và browser regression I1 |
| `docker compose up --build -d backend` | PASS build Java 21 và cập nhật backend local, không reset database |
| `./scripts/smoke/local.ps1` | PASS frontend HTTP 200, API UP, schema campus 15 bảng |

Unit test: EventRules 6, EventService 5, EventReadService 6, RegistrationRules 4, WaitlistService 3, EmailDispatcher 5. Các test mới kiểm tra biên giờ mở/đóng/bắt đầu, khoa AND năm, dừng FIFO khi sang giờ bắt đầu, giới hạn số chỗ, bỏ qua người không hợp lệ, mail tắt, chặn miền fixture, bỏ mail lượt cũ và xử lý lỗi provider.

Log máy local nằm trong `backend/target/i2-unit.log`, `i2-integration.log`, `i2-i1-regression.log`, `i2-local-build.log`, cùng `surefire-reports/`. Đây là output bị Git ignore; repository giữ kịch bản tái chạy và bản ghi kết quả này.

## Các trường hợp I2 đã đạt

| Nhóm | Bằng chứng kiểm tra |
| --- | --- |
| Quyền và dữ liệu riêng | Anonymous 401; Admin/Organizer không đăng ký thay Student; thiếu CSRF 403; Student không đọc danh sách người tham gia; Organizer khác 404; field studentId giả không thay người thực hiện |
| Validation/điều kiện | Nháp 404, đóng đăng ký 409; khoa AND năm, nhiều lựa chọn/rỗng; tham số id/status/page/size sai bị chặn; unit test so đúng instant khi khác offset |
| Sức chứa/đồng thời | Sáu Student tranh một chỗ: đúng một REGISTERED, năm WAITLISTED. Bốn request đăng ký lại cùng người active: một dòng hiện hành, một history và một email xác nhận |
| Hủy/FIFO | Version cũ 409, hủy lặp idempotent; hủy sau đóng đăng ký vẫn đôn đúng đầu hàng hợp lệ; không nhận mới sau đóng; tăng 1→3 nhận hai người tiếp theo; không giảm dưới số đã đăng ký |
| Bỏ qua người chờ | Người đầu hàng sai năm bị SKIP, người sau hợp lệ được nhận; có history có lý do. Khi hợp lệ trở lại, được xét theo timestamp cũ trước người mới ở lần xử lý tiếp theo |
| Đăng ký lại/điểm danh | Giữ nguyên registration.id; hủy giữ PRESENT làm bằng chứng; đăng ký lại vào cuối hàng hiện hành; reset NOT_RECORDED/SYSTEM; đúng một attendance_history và một REREGISTER |
| Sửa sự kiện | Sửa location tạo EVENT_CHANGED cho REGISTERED/WAITLISTED; tăng sức chứa tạo WAITLIST_PROMOTED; còn chặn thay khoa/năm khi có REGISTERED |
| Transaction | Chèn lỗi ghi outbox bằng trigger tạm trong DB test: đăng ký rollback hoàn toàn; hủy/đôn/history cùng rollback, không để trống chỗ do ghi một phần |
| Brevo transport giả lập | Gửi đủ ba kind; nội dung UTF-8, giờ Việt Nam, HTML escape; HTTP 503 retry rồi thành công; HTTP 400 dừng ngay và giữ attempts thực |
| Retry/dedupe/lease | 503 liên tục dừng ở 5 attempts; nhận thành công nhưng response lỗi rồi retry dùng cùng UUID được provider giả dedupe; lease hết hạn được nhận lại; lease cuối cùng thành FAILED thay vì kẹt PROCESSING |
| Mail lượt cũ | Payload registrationVersion cũ bị FAILED/STALE_REGISTRATION trước khi gọi transport |

Sau bài test đầy đủ, database test có SENT cho cả ba kind: EVENT_CHANGED 5, REGISTRATION_CONFIRMED 10, WAITLIST_PROMOTED 6. Các fixture lỗi được giữ FAILED đúng kịch bản. Tất cả thư trong bộ test gửi tới **server giả lập trong Docker**, không gọi Brevo thật và không gửi tới inbox thật. Đây không phải bằng chứng vận hành đa instance hoặc load test quy mô lớn.

## Regression I1

HTTP/PostgreSQL tiếp tục đạt: đăng ký tài khoản, email/MSSV trùng và rollback, login/logout, khóa/mở/thu hồi phiên, quyền cố định, bảo vệ Admin cuối cùng khi đồng thời, seed idempotence/restart, Organizer create/edit/publish, optimistic version, tìm kiếm Unicode/literal, phân trang và ẩn nháp.

Browser regression đạt: validation, tài khoản/phiên/reload, quản trị và xác nhận/hủy, mật khẩu tạm, logout khi mất mạng, form sự kiện, xung đột hai tab, công bố, bố cục mobile. Frontend I2 chưa nằm trong bộ này.

Một expectation cũ của I1 được cập nhật có chủ đích: đổi lịch/địa điểm khi có người đăng ký nay thành công và tạo EVENT_CHANGED cùng transaction, thay vì chặn tạm 409. Giới hạn khoa/năm khi đã có REGISTERED vẫn 409.

## Local và các phần còn lại

Backend mới chạy tại http://localhost:8080; Angular qua http://localhost:4200. PostgreSQL vẫn dùng volume phát triển hiện có. Không thay schema 15 bảng hoặc xóa dữ liệu. `MAIL_ENABLED` local đang tắt; outbox vẫn được ghi, chỉ gửi thật khi người dùng bật cấu hình theo [API I2](../api/I2.md). Một thư Brevo thật đã được gửi và người dùng xác nhận nhận được trước khi implement; bộ test hiện tại không gửi thêm thư thật.

Cần làm tiếp để đóng toàn I2/CP2:

- Nối frontend đăng ký/hủy, danh sách của tôi và danh sách người tham gia; kiểm thử loading/error/empty/conflict trên giao diện.
- Demo nghiệp vụ đầu cuối với frontend I2, lưu biên bản/phản hồi và review độc lập theo quy trình nhóm.
- Nếu deploy: cấu hình HTTPS/proxy/cookie, backend Render/DB Neon, secret, kiểm tra cold start và thời gian worker hoạt động trên môi trường thực. Chưa coi RA02 Lightsail đã thực hiện.

Giới hạn: SENT là provider accepted; chưa có delivered/bounce webhook. Dedupe provider có thời hạn, không hứa exactly-once. Không có reminder hoặc worker độc lập; backend ngủ thì email chờ. Chưa có QR/manual attendance API hoặc CSV. Chưa có tự quét khi hồ sơ đổi; FIFO xử lý khi đăng ký/hủy/sửa sự kiện. Các khối mockup vượt phạm vi vẫn được bảo tồn/tạm vô hiệu hóa.
