# Backend BKevent — Spring Boot / Java 21

Backend là một ứng dụng monolith theo kiến trúc phân tầng, package theo tầng. Tham khảo cách tổ chức Controller–Service–Repository và interface của [HAPPY_TUTORING_SYSTEM](https://github.com/ThuyHien2506/HAPPY_TUTORING_SYSTEM/tree/main/backend/src/main/java/com/project/happy); tiếp tục dùng PostgreSQL/JdbcTemplate, không chuyển sang dữ liệu in-memory hoặc SSO của repo mẫu.

## Cấu trúc

```text
src/main/java/vn/edu/hcmut/campusevents/
├── CampusEventsApplication.java
├── controller/              HTTP endpoints, validation đầu vào; chỉ gọi service
├── service/                 IAuthService, IAccountService, ICatalogService,
│   │                        IEventService, IRegistrationService, IWaitlistService,
│   │                        IEmailQueueService, IEmailOutboxService, IEmailSender,
│   │                        IEnvironmentService, ISeedService
│   └── impl/                *ServiceImpl: nghiệp vụ và transaction
├── repository/              IUserRepository, ISessionRepository,
│   │                        IAccountHistoryRepository, ICatalogRepository,
│   │                        IEventRepository, IRegistrationRepository,
│   │                        IEmailOutboxRepository, IEnvironmentRepository, ISeedRepository
│   └── jdbc/                Jdbc*Repository: toàn bộ SQL PostgreSQL
│       └── mapper/          RowMapper: ResultSet → model
├── dto/                     Request/response HTTP
│   ├── auth/
│   ├── account/
│   ├── catalog/
│   ├── event/
│   └── registration/
├── model/                   Snapshot nội bộ, EventContent, cấu hình seed
├── mapper/                  Model → response, loại bỏ dữ liệu nhạy cảm
├── validation/              PasswordValidator, EventRules, RegistrationRules
├── security/                SecurityConfig, AuthPrincipal, filter, cookie, token
├── exception/               ApiException, GlobalExceptionHandler
└── config/                  Khởi tạo danh mục/seed, MailSettings, EmailDispatcher
```

Interface nằm ở `service/` và `repository/`; các lớp triển khai ở `service/impl/` và `repository/jdbc/`. Spring inject implementation qua constructor. Interface không phải service triển khai độc lập. Không cần interface cho DTO, Controller, mapper hoặc từng lớp tiện ích.

## Luồng xử lý

```text
Angular → Security filter → Controller
    → IService → ServiceImpl (@Transactional)
    → IRepository → JdbcRepository → PostgreSQL
    → model → mapper → response DTO → Angular
```

- Controller xử lý HTTP/Bean Validation; không gọi Repository hay JdbcTemplate trực tiếp.
- Service giữ nghiệp vụ, ownership, version và transaction. Không chứa SQL, không phụ thuộc lớp repository cụ thể.
- Repository không công khai JdbcTemplate; cung cấp phương thức theo ý nghĩa thao tác dữ liệu. Các repository cùng tham gia transaction hiện hành của service.
- Khóa tài khoản: kiểm tra Admin dưới advisory lock → cập nhật user → thu hồi session → ghi audit trong cùng transaction. Bất kỳ lỗi ghi nào đều rollback cả ba.
- Công bố/sửa sự kiện: khóa sự kiện → kiểm tra tài khoản/phiên trong transaction → kiểm tra chủ sở hữu/version và dữ liệu → ghi. `EventRules` giữ quy tắc thuần.
- Đăng ký/hủy: khóa sự kiện → kiểm tra tài khoản/phiên → kiểm tra điều kiện/thời hạn/version → ghi đăng ký/history → xử lý FIFO/outbox cùng transaction. Worker gửi email sau commit; lỗi nhà cung cấp không làm mất đăng ký đã lưu.
- `User` có dữ liệu xác thực nội bộ. Chỉ `AccountResponse` được gửi ra HTTP/ghi audit; không serialize `User`, `AuthenticatedLogin` hoặc `SeedOptions` vào response/log. Mật khẩu hash và token không được đưa vào response JSON/audit.
- `SessionAuthenticationFilter` chỉ được gắn vào Spring Security chain, không đăng ký thêm servlet filter gây chạy hai lần.
- Seed/bootstrap opt-in: `SeedRunner` đọc cấu hình → `ISeedService` → repository. Không xóa dữ liệu hoặc ghi đè tài khoản/mật khẩu cũ.

## Chạy local và kiểm thử

Từ **root repository**, mở Docker Desktop rồi chạy:

```powershell
./scripts/setup-local.ps1
docker compose up --build -d
./scripts/smoke/local.ps1
```

Frontend: http://localhost:4200. Backend: http://localhost:8080. Cấu hình `.env` được Compose truyền vào container; Spring Boot không tự đọc file này khi chạy Maven trực tiếp.

Chạy backend bằng Maven (đã có PostgreSQL và `.env`):

```powershell
# Xóa class cũ sau khi đổi package để tránh duplicate beans/mappings.
mvn -f backend/pom.xml clean
./scripts/start-backend.ps1
```

Unit test và integration test (root repository):

```powershell
mvn -f backend/pom.xml clean test
./scripts/test-i1.ps1
./scripts/test-i2.ps1
```

Integration test I1 dùng project campus-events-i1-test, DB tmpfs riêng và API cổng 18080. Browser regression: `./scripts/test-i1.ps1 -PlaywrightModule <duong-dan-module-playwright>`. Test I2 dùng project riêng và API 18081, mail giả lập 19090. Không reset volume phát triển.

DDL nằm ở database/schema, không tự chạy khi backend khởi động. Các lệnh seed và biến môi trường I1 giữ nguyên. Health `/api/health`: 200 UP nếu đủ 15 bảng và truy vấn events được, 503 nếu chưa sẵn sàng. Tham khảo [seed/bootstrap](../database/seeds/README.md).

I2 đã bổ sung đăng ký/hủy/FIFO/email theo API bên dưới. Mặc định không gửi thư thật; cấu hình Brevo đặt ở backend. Worker chạy chung JAR, lease/outbox lưu trong PostgreSQL. Backend vẫn là một JAR/Docker image; chưa triển khai QR hoặc cloud Render/Neon.

Backend I2 đã qua 29 unit test, HTTP/PostgreSQL I2, regression I1 gồm browser và smoke local ngày 12/11/2026. Kết quả này chưa thay review độc lập hoặc đóng CP2.

<a id="i2-api"></a>

## API Increment 2 — đăng ký, FIFO và email

Phạm vi backend A07.1–A07.3 theo Bảng 23/Bảng 33 trong báo cáo `main (8).pdf`. Dùng PostgreSQL và cơ chế cookie HttpOnly + CSRF của I1. Frontend I2 chưa nối API; QR/điểm danh và CSV thuộc increment sau. Không đổi schema hiện hành hoặc reset dữ liệu.

### Endpoint

Base `/api`. POST cần `X-XSRF-TOKEN` lấy từ `/auth/csrf` và cookie phiên. Định danh sinh viên lấy từ phiên; không nhận `studentId` để đăng ký thay người khác.

| Method / path | Quyền | Kết quả |
| --- | --- | --- |
| POST `/events/{eventId}/registrations` | STUDENT | Không cần body. 201 khi tạo lượt đăng ký, 200 khi đã REGISTERED/WAITLISTED |
| POST `/events/{eventId}/registration/cancel` | STUDENT | Body `{"version":1}`, trả đăng ký sau hủy |
| GET `/events/{eventId}/registration` | STUDENT | Trạng thái của chính mình, điều kiện và số chỗ |
| GET `/me/registrations` | STUDENT | Các đăng ký của chính mình, có phân trang/lọc trạng thái |
| GET `/organizer/events/{eventId}/registrations` | ORGANIZER sở hữu sự kiện | Danh sách sinh viên, email/MSSV/khoa/năm/trạng thái và tổng số |

Hai danh sách nhận `page` từ 0 đến 100000, `size` từ 1 đến 100 (mặc định 20), `status` bỏ trống hoặc REGISTERED/WAITLISTED/CANCELLED. Trả `items,page,size,hasNext`. Danh sách Organizer thêm `registeredCount,waitingCount,capacity`. Organizer khác nhận 404; Admin không có quyền Organizer/Student.

Đăng ký trả các trường:

```json
{
  "id": 42, "eventId": 6, "studentId": 15,
  "status": "REGISTERED", "version": 1,
  "waitlistedAt": null, "registeredAt": "2026-11-12T12:00:00+07:00",
  "cancelledAt": null, "queuePosition": null,
  "eventTitle": "Workshop", "location": "Hội trường",
  "startsAt": "2026-11-13T08:00:00+07:00", "endsAt": "2026-11-13T10:00:00+07:00"
}
```

GET trạng thái trả `eventId,registration` (null nếu chưa đăng ký), `eligible,registrationOpen,registeredCount,waitingCount,availableSeats`. `queuePosition` chỉ có với WAITLISTED, đếm vị trí trong hàng chờ theo thời gian/id, gồm cả người hiện không hợp lệ; đây không phải lời hứa về thứ tự được nhận chỗ.

### Quy tắc nghiệp vụ và transaction

- Chỉ đăng ký sự kiện PUBLISHED trong khoảng **mở ≤ giờ database < đóng**, đồng thời trước starts_at. Sức chứa nguyên dương; chỉ REGISTERED chiếm chỗ. Hết chỗ thì WAITLISTED.
- Điều kiện khoa AND năm; trong mỗi nhóm chọn nhiều là OR; nhóm rỗng nghĩa là tất cả. Không lọc quyền xem sự kiện theo điều kiện tham gia.
- Mọi thao tác thay đổi đăng ký/sức chứa khóa event trước, rồi tài khoản người thực hiện và các dòng đăng ký. Event lock serialize các request cùng sự kiện, tránh vượt sức chứa; UNIQUE(event_id,student_id) giữ một dòng hiện hành. Viết đăng ký/history/outbox cùng transaction, lỗi bất kỳ sẽ rollback.
- Trước khi nhận một người mới, đôn người chờ cũ hợp lệ theo `(waitlisted_at,id)`. Hủy hoặc sửa sự kiện (bao gồm tăng sức chứa) cũng chạy đôn chờ trước khi commit.
- Đôn chờ tiếp tục sau giờ đóng đăng ký **đến trước starts_at**. Không nhận đăng ký mới sau giờ đóng. Không đôn kể từ starts_at.
- Người chờ không đủ điều kiện được bỏ qua, ghi SKIP có lý do, vẫn giữ WAITLISTED. Nếu hợp lệ trở lại, timestamp cũ được dùng ở lần xử lý tiếp theo. Không triển khai quy trình riêng khóa/mở tài khoản hay tác vụ tự quét khi hồ sơ đổi; lần xử lý tiếp theo do đăng ký/hủy/sửa sự kiện kích hoạt. Luồng thông thường không cần Admin tham gia.
- Hủy REGISTERED/WAITLISTED trước starts_at, kể cả đã đóng đăng ký. `version` cũ trả 409; hủy lại khi đã CANCELLED trả 200 hiện trạng, không ghi lặp history/đôn/email. Tương tự, đăng ký lại khi còn active trả 200, kể cả đã đóng đăng ký.
- CANCELLED → đăng ký lại chỉ trong cửa sổ đăng ký và khi đủ điều kiện. Tái sử dụng id, tăng version, ưu tiên chờ mới. Trigger database giữ snapshot điểm danh cũ, reset NOT_RECORDED/SYSTEM và ghi attendance_history + REREGISTER một lần, cùng transaction. Hủy chỉ giữ bằng chứng cũ; không tự reset.
- Tăng sức chứa đôn tối đa số chỗ còn thiếu. Sửa dùng event.version của I1; không giảm dưới số REGISTERED. Chưa cho đổi khoa/năm khi còn REGISTERED. Đổi địa điểm hoặc thời gian mở/đóng/bắt đầu/kết thúc tạo thông báo; sửa mô tả/tiêu đề/sức chứa đơn thuần không tạo EVENT_CHANGED.

### Email và outbox

| Kind | Khi tạo | Người nhận |
| --- | --- | --- |
| REGISTRATION_CONFIRMED | Đăng ký mới/đăng ký lại được REGISTERED | Sinh viên vừa có chỗ |
| WAITLIST_PROMOTED | WAITLISTED được đôn lên REGISTERED | Sinh viên vừa được đôn |
| EVENT_CHANGED | Organizer đổi địa điểm hoặc thời gian | REGISTERED và WAITLISTED hiện hành |

Không gửi mail chỉ vì vào hàng chờ/hủy; chưa có nhắc trước sự kiện. Khi vừa sửa vừa đôn, email cũ của phiên bản đăng ký trước có thể bị loại; email đôn chứa thông tin mới.

Service chỉ ghi `email_outbox`. `EmailDispatcher` chạy định kỳ trong backend → claim bằng `FOR UPDATE SKIP LOCKED` và lease 60 giây → commit → gửi HTTP Brevo → lưu kết quả bằng lease/attempt tương ứng. Không giữ transaction khi gọi nhà cung cấp. Nhiều instance không claim cùng một lease; process chết được phục hồi sau lease.

Lỗi mạng/429/5xx được retry với thời gian đợi 5,10,20,40… giây (trần 300), tối đa 5 lần mặc định. Lỗi 4xx khác dừng ngay, giữ số attempts thực và đặt next_attempt_at=infinity. Quá số lần retry giữ FAILED để kiểm tra, không tự lặp vô hạn. `last_error` chỉ lưu mã lỗi, không lưu key/body lỗi riêng tư.

Dedupe key phân biệt registration/version/kind và event.version khi thay đổi sự kiện; gửi UUID ổn định qua idempotencyKey. Trước gửi, so phiên bản/trạng thái đăng ký; email của lượt cũ bị kết thúc bằng FAILED/STALE_REGISTRATION. Kiểm tra này không thu hồi được email đã gửi hoặc hoàn toàn loại bỏ race giữa kiểm tra và HTTP. Outbox bảo đảm lưu yêu cầu sau commit; không cam kết exactly-once, vì dedupe phía provider có thời hạn. **SENT chỉ có nghĩa provider đã nhận yêu cầu**, chưa phải đã tới inbox; chưa có webhook theo dõi delivered/bounce.

### Cấu hình và chạy local

Mặc định `MAIL_ENABLED=false`: vẫn ghi outbox, không gọi Brevo. Trong `.env` local (đã được Git ignore), đặt:

```dotenv
MAIL_ENABLED=true
BREVO_API_KEY=your-private-api-key
BREVO_SENDER_EMAIL=your-verified-sender
BREVO_SENDER_NAME=BKevent
```

Sender cần xác minh trong Brevo. Từ root repository:

```powershell
docker compose up --build -d backend
./scripts/smoke/local.ps1
# Hoặc khi chạy Java trên máy, dùng ./scripts/start-backend.ps1
```

Bật gửi sẽ xử lý cả các email hợp lệ đã chờ từ trước; nên kiểm tra outbox trước. Không bật cho database chứa email thử trông giống địa chỉ thật. Mặc định chặn các miền thử phổ biến như .test/.invalid/.example/example.com/.local; không dựa vào bộ chặn này để xác nhận sự đồng ý của người nhận. Test stack dùng key giả, URL nội bộ và cờ cho phép miền thử riêng, không sử dụng credential trong `.env`.

Các biến nâng cao khi chạy backend trực tiếp/deploy: `MAIL_MAX_ATTEMPTS` (1–10, mặc định 5), `MAIL_POLL_MS` (5000), `MAIL_INITIAL_DELAY_MS` (10000), `BREVO_API_URL` (https://api.brevo.com). `MAIL_ALLOW_TEST_RECIPIENTS` chỉ dành cho test transport. Compose local chỉ truyền các biến gửi mail cơ bản ở trên.

Kiểm tra không lộ bí mật:

```powershell
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id,kind,status,attempts,last_error FROM campus.email_outbox ORDER BY id DESC LIMIT 20;"'
```

Không đưa key vào frontend/Git, không in toàn bộ `.env` hoặc `docker compose config`. Khi deploy Render dùng HTTP API, cấu hình các biến trên ở backend. Worker chạy chung JAR; khi host ngủ/dừng, email phải đợi host chạy lại. Chưa triển khai cloud, webhook, lịch nhắc hoặc worker chạy liên tục độc lập.

### Lỗi thường gặp

| HTTP / code | Ý nghĩa |
| --- | --- |
| 400 VALIDATION_ERROR / INVALID_JSON | Id/version/filter/page hoặc JSON không hợp lệ |
| 401 UNAUTHENTICATED | Chưa đăng nhập, phiên hết hạn/thu hồi |
| 403 FORBIDDEN | Sai vai trò, thiếu CSRF; mật khẩu tạm còn phải đổi |
| 403 NOT_ELIGIBLE | Không thuộc khoa/năm được tham gia |
| 404 EVENT_NOT_FOUND | Không có sự kiện PUBLISHED hoặc ngoài phạm vi Organizer |
| 404 REGISTRATION_NOT_FOUND | Chưa có đăng ký để hủy |
| 409 REGISTRATION_CLOSED | Chưa mở/đã đóng đăng ký |
| 409 EVENT_STARTED | Đã bắt đầu, không thể hủy |
| 409 VERSION_CONFLICT | Đăng ký/sự kiện đã thay đổi |
| 409 CAPACITY_BELOW_REGISTERED / REGISTERED_ELIGIBILITY_CHANGE | Sửa sự kiện ảnh hưởng đăng ký hiện hành |
| 503 SERVICE_UNAVAILABLE | Lỗi dữ liệu; transaction không ghi một phần |

### Kiểm thử

```powershell
mvn -f backend/pom.xml test
./scripts/test-i2.ps1
./scripts/test-i1.ps1
```

I2 test dùng project `campus-events-i2-test`: PostgreSQL tmpfs riêng, API localhost:18081, Brevo giả lập localhost:19090. Không xóa volume local. Chạy lại script sẽ thay toàn bộ fixtures của riêng project test. Dừng sau kiểm tra trong cùng terminal:

```powershell
docker compose -p campus-events-i2-test -f compose.i2-test.yaml down
```

Frontend I2, demo/biên bản/phản hồi và review độc lập vẫn cần hoàn tất trước khi đóng CP2. Chưa triển khai cloud.
