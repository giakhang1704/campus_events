# Backend BKevent — Spring Boot / Java 21

Backend là một ứng dụng monolith theo kiến trúc phân tầng, package theo tầng. Tham khảo cách tổ chức Controller–Service–Repository và interface của [HAPPY_TUTORING_SYSTEM](https://github.com/ThuyHien2506/HAPPY_TUTORING_SYSTEM/tree/main/backend/src/main/java/com/project/happy); tiếp tục dùng PostgreSQL/JdbcTemplate, không chuyển sang dữ liệu in-memory hoặc SSO của repo mẫu.

## Cấu trúc

```text
src/main/java/vn/edu/hcmut/campusevents/
├── CampusEventsApplication.java
├── controller/              HTTP endpoints, validation đầu vào; chỉ gọi service
├── service/                 IAuthService, IAccountService, ICatalogService,
│   │                        IEventService, IEnvironmentService, ISeedService
│   └── impl/                *ServiceImpl: nghiệp vụ và transaction
├── repository/              IUserRepository, ISessionRepository,
│   │                        IAccountHistoryRepository, ICatalogRepository,
│   │                        IEventRepository, IEnvironmentRepository, ISeedRepository
│   └── jdbc/                Jdbc*Repository: toàn bộ SQL PostgreSQL
│       └── mapper/          RowMapper: ResultSet → model
├── dto/                     Request/response HTTP
│   ├── auth/
│   ├── account/
│   ├── catalog/
│   └── event/
├── model/                   Snapshot nội bộ, EventContent, cấu hình seed
├── mapper/                  Model → response, loại bỏ dữ liệu nhạy cảm
├── validation/              PasswordValidator, EventRules
├── security/                SecurityConfig, AuthPrincipal, filter, cookie, token
├── exception/               ApiException, GlobalExceptionHandler
└── config/                  Khởi tạo danh mục/seed và danh mục khoa
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
- Công bố sự kiện: kiểm tra lại tài khoản/phiên trong transaction → khóa sự kiện và kiểm tra chủ sở hữu/version → kiểm tra dữ liệu → công bố. `EventRules` giữ quy tắc thuần.
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
```

Integration test dùng project `campus-events-i1-test`, DB tmpfs riêng và backend cổng 18080; không reset volume phát triển. Browser regression tùy chọn và chi tiết lệnh xem `docs/testing/I1_RESULTS.md`.

DDL nằm ở `database/schema`, không tự chạy khi backend khởi động. API và payload giữ tương thích `docs/api/I1.md`; các lệnh seed và biến môi trường giữ nguyên. Health `/api/health`: 200 UP nếu đủ 15 bảng và truy vấn events được, 503 nếu chưa sẵn sàng.

Refactor chưa bổ sung đăng ký tham gia/QR/email hoặc cấu hình production Render/Neon. Vẫn là một JAR/Docker image; cấu trúc package không thay cách deploy.

Kết quả kiểm chứng lần refactor: [BACKEND_REFACTOR_RESULTS.md](../docs/testing/BACKEND_REFACTOR_RESULTS.md).
