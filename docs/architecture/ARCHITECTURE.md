# Kiến trúc triển khai được, độc lập nhà cung cấp

Chọn modular monolith: một backend Spring Boot chia module nghiệp vụ, một frontend Angular SPA, một PostgreSQL. Cùng một repository; frontend/backend build thành hai artifact độc lập. Package gốc đề xuất đã tạo: vn.edu.hcmut.campusevents. Đã khởi tạo Angular 21.0.0, Spring Boot 3.5.7/Java 21; Docker PostgreSQL 17. Xem LOCAL_RUN.md.

## Module và trách nhiệm
Frontend src/app/core (auth/interceptor/config), shared (UI dùng chung), features (auth/events/registrations/attendance/reports/admin). Không kết nối DB trực tiếp.
Backend config, security, common và auth/users/events/registrations/attendance/reports/notifications. Mỗi module thêm controller, dto, service, repository, entity khi có mã thực tế. Controller nhận request, service giữ nghiệp vụ và transaction, repository truy cập DB. Module khác gọi service công khai, tránh ghi trực tiếp dữ liệu của nhau mà bỏ qua quy tắc. Không trả entity chứa password/token.

## Local
Angular dev server -> development proxy /api -> Spring Boot -> PostgreSQL local. pgAdmin/psql là công cụ kiểm tra DB. Đã có proxy.conf.json cho dev và Nginx proxy /api cho Compose.

## Phương án demo tiết kiệm đang xem xét
Vercel phục vụ Angular SPA; backend Java và PostgreSQL chạy ở nhà cung cấp khác. Vercel không được coi là nơi chạy Spring Boot JAR/PostgreSQL. Có thể đánh giá Render cho backend, nhưng cần kiểm tra RAM, cold start, worker email và cách đóng gói Java theo nền tảng. Chưa chọn nhà cung cấp database cloud.
Nếu FE/API khác origin: dùng HTTPS, allowlist CORS chính xác; quyết định cơ chế session và CSRF/cookie trước khi triển khai. Origin preview không được mặc định mở rộng thành *. Không để credentials trong frontend. Nếu worker bị ngủ, outbox phải xử lý tiếp sau khi backend thức lại; không cam kết gửi email tức thì.

## Phương án Lightsail theo báo cáo
Internet HTTPS -> Nginx -> Angular static files hoặc /api -> Spring Boot (127.0.0.1:8080) -> PostgreSQL local. Nginx đảm nhiệm TLS, SPA fallback và reverse proxy. Backend chạy bằng systemd dưới user riêng; cấu hình bí mật ngoài repository. Public 80/443; SSH giới hạn nguồn; không public 5432/8080. Kiểm tra cả IPv4/IPv6 và firewall máy chủ.

## Vận hành cho cả hai phương án
- Health/readiness không lộ bí mật; log request/error, theo dõi lỗi gửi email và DB.
- Khóa event khi kiểm tra chỗ, đăng ký/hủy/tăng sức chứa/đôn FIFO. Ghi history/outbox cùng commit; gửi email sau commit.
- Một dòng đăng ký hiện hành, reset attendance có audit khi đăng ký lại; reset đã có trigger; service nghiệp vụ chưa triển khai.
- Một nguồn migration schema; hiện database/schema/01_schema.sql là baseline chạy một lần. Khi chọn công cụ migration, chuyển baseline vào đó và cập nhật tài liệu; không dùng ORM auto-update song song.
- Backup PostgreSQL và thử restore vào database riêng. Backup ngoài máy chủ nếu cần chịu được mất instance. Không coi file backup chưa restore thử là bằng chứng khôi phục.
- Release có version; rollback frontend/JAR độc lập. Database cần migration tương thích phiên bản; không tự rollback schema bằng xóa dữ liệu.

## Giới hạn
Single-instance không có high availability; cần test tải và bộ nhớ Java + DB. Folder tree không chứng minh deployment thành công. Không tự thêm Docker/CI/CD; nếu chọn nền tảng bắt buộc container sẽ bổ sung sau. Chưa tạo tài nguyên trả phí và chưa thay baseline báo cáo từ Lightsail sang nền tảng khác.


## Neon — cập nhật phương án demo
Đề xuất Neon cho PostgreSQL cloud; xem deploy/neon/README.md. Vẫn cần host riêng cho Spring Boot; chưa chốt provider backend, chưa tạo Neon project, chưa kiểm tra schema trên Neon. Kiến trúc modular monolith không thay đổi. Các đoạn trước ghi chưa chọn DB cloud là trạng thái trước đề xuất này.


## Trạng thái bản chạy local
Đã có Dockerfile frontend/backend và compose.yaml; đã có API tài khoản và nghiệp vụ Organizer tạo/sửa/công bố sự kiện. Angular nhúng mockup public/mockup để xem trước, không coi đó là Angular implementation của toàn bộ chức năng. Xem LOCAL_RUN.md và SMOKE_TEST.md trước khi chạy.

## Backend phân tầng — cập nhật 12/11/2026

Backend hiện là **layered monolith**, tổ chức package theo tầng: `controller`, `service` + `impl`, `repository` + `jdbc`, `dto`, `model`, `mapper`, `validation`, `security`, `exception`, `config`. Các mô tả modular monolith/package theo chức năng ở phần lịch sử trước đây không còn mô tả cách nhóm package hiện hành.

`Controller → IService → ServiceImpl → IRepository → JdbcRepository → PostgreSQL`. Service/Repository có interface; không lộ JdbcTemplate lên tầng nghiệp vụ. Các repository dùng chung transaction do Service mở. Interface là hợp đồng Java, không phải microservice. Toàn bộ backend vẫn deploy thành một JAR/Docker image.

SQL tài khoản/phiên/audit/seed/health đã chuyển vào Repository. Controller không truy cập Repository trực tiếp. Request/response tách khỏi Controller và model nội bộ; AccountMapper chỉ đưa trường công khai vào JSON/audit, EventMapper giữ nguyên payload sự kiện. Security filter/cookie/token tách khỏi cấu hình và Controller.

Công bố sự kiện: EventController → IEventService → EventServiceImpl; gọi IAuthService để recheck tài khoản/phiên và giữ khóa user trong cùng transaction, kiểm tra ownership/version bằng EventRules rồi ghi qua IEventRepository. Kiểm tra khoa/đơn vị qua ICatalogRepository. Đọc danh sách PUBLISHED tiếp tục dùng REPEATABLE_READ để fields và eligibility cùng snapshot; eligibility được đọc theo lô.

Khóa tài khoản: AccountServiceImpl giữ advisory lock trước khi kiểm tra actor/target, bảo vệ Admin cuối cùng, cập nhật trạng thái/auth_version, thu hồi phiên và ghi audit nguyên tử. Preview vẫn không ghi; khi xác nhận sẽ kiểm tra lại điều kiện và version.

Chi tiết cây thư mục, trách nhiệm và lệnh chạy: [backend/README.md](../../backend/README.md). Không thay endpoint, JSON, schema hoặc dữ liệu; không triển khai I2 registration/QR/cloud trong refactor này.

## Backend I2 — 12/11/2026

Trên nền refactor, thêm RegistrationController → IRegistrationService → RegistrationServiceImpl → IRegistrationRepository/JdbcRegistrationRepository. Service giữ event lock xuyên suốt đăng ký/hủy/FIFO, thứ tự event → actor user → registrations; cập nhật sự kiện dùng cùng thứ tự để tránh đảo khóa. RegistrationRules giữ điều kiện và biên thời gian. IWaitlistService được dùng chung bởi đăng ký, hủy và cập nhật sức chứa, không có endpoint đôn chờ tùy ý.

IEmailQueueService ghi email_outbox trong transaction hiện hành. EmailDispatcher → IEmailOutboxService thực hiện claim/hoàn tất trong transaction ngắn; IEmailSender/BrevoEmailSender gọi HTTP bên ngoài transaction. Dedupe/lease/retry lưu PostgreSQL, không phụ thuộc RAM của một instance. Worker chạy cùng backend và chỉ hoạt động khi backend chạy. Chưa có worker độc lập hoặc cấu hình cloud được kiểm chứng; không coi cấu trúc này là bằng chứng đã deploy. Xem [API I2](../api/I2.md).
