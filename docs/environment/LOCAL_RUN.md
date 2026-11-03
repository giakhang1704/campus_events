# Chạy localhost

Angular 21.0.0, Spring Boot 3.5.7, Java 21, PostgreSQL 17, Node 24, Maven 3.9.11. Đây là phiên bản khởi tạo mới, không thay phiên bản ứng dụng có sẵn.

## Xem mockup ngay, không cần Docker hoặc backend

Nếu đã có Python, từ project root:

```powershell
python -m http.server 4201 --bind 127.0.0.1 --directory .\frontend\public\mockup
```

Mở http://localhost:4201. Dừng bằng Ctrl+C trong terminal. Đây chỉ là mockup localStorage, không kiểm tra kết nối DB. Có thể mở trực tiếp frontend/public/mockup/index.html bằng trình duyệt nếu không có Python.

## Docker Desktop — chạy toàn bộ

Mở Docker Desktop, chọn Linux containers và đợi Engine running. Không cần cài Node/Java/PostgreSQL riêng. Từ PowerShell:

```powershell
# Chạy từ thư mục gốc repository (chứa compose.yaml).
.\scripts\setup-local.ps1
docker compose up --build -d
docker compose ps
docker compose logs --tail 100 backend
```

Mở http://localhost:4200, bấm **Kiểm tra kết nối**. API trực tiếp: http://localhost:8080/api/health. Đợi backend khởi động rồi thử lại. Lần đầu cần tải image và dependency.

`.env` được Compose đọc và truyền vào container, Spring Boot không tự đọc file này. Không commit secret. Cổng chỉ bind 127.0.0.1; đây là cấu hình local.

setup-local.ps1 chỉ tạo .env nếu chưa có và sinh mật khẩu local, không in ra màn hình. Nếu muốn cấu hình thủ công, copy .env.example thành .env rồi thay POSTGRES_PASSWORD. Nếu đã có .env, script giữ nguyên.

```powershell
.\scripts\smoke\local.ps1
Get-Content -Raw .\database\tests\01_inspect.sql | docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
Get-Content -Raw .\database\tests\02_registration_reset.sql | docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose down
docker compose up -d
```

SQL regression tạo fixtures rồi ROLLBACK. `down` giữ named volume. Không dùng `down -v` nếu cần giữ dữ liệu. Schema chỉ tự tạo khi volume rỗng; sửa file SQL không tự nâng cấp database cũ. Không chạy lại CREATE SCHEMA lên DB đang dùng.

## Những gì bạn nhìn thấy

Angular gọi API health thật, backend truy vấn PostgreSQL thật. Mockup bên dưới dùng localStorage; đăng nhập, QR, đăng ký và email vẫn mô phỏng, chưa có API nghiệp vụ. Các khối đã thay trong mockup được giữ bằng comment, bản gốc nằm ở docs/references.

## Phát triển với công cụ local

Cần Node 24, JDK tương thích target 21, Maven 3.9+. Không chạy FE/BE local trùng cổng FE/BE Docker.

Cách ngắn để chạy backend bằng giá trị trong `.env`: từ root chạy `./scripts/start-backend.ps1`. Script chỉ đọc các khóa local đã biết, không thực thi nội dung file và không in mật khẩu. Đây là cơ chế nạp tường minh, không phải Spring Boot tự đọc `.env`. Giá trị mẫu dùng dạng `KEY=value` không thêm dấu nháy.

```powershell
# Từ root, chạy riêng DB
docker compose up -d db
# Terminal backend, dùng giá trị thực theo .env
$env:DB_URL='jdbc:postgresql://localhost:5432/campus_events_dev?currentSchema=campus'
$env:DB_USER='campus_app'
# Đặt biến DB_PASSWORD trong terminal bằng mật khẩu local, không commit.
Set-Location .\backend
mvn spring-boot:run
```

Terminal frontend từ root:

```powershell
Set-Location .\frontend
npm.cmd ci
npm.cmd start
```

Mở http://localhost:4200. Proxy dev gọi localhost:8080. Build: frontend `npm.cmd run build`, backend `mvn -B package`. Output lần lượt là dist/campus-events/browser và target/campus-events.jar.

## pgAdmin, Neon và cấu hình cổng

pgAdmin kết nối DB Docker: host localhost, port POSTGRES_PORT (mặc định 5432), database/user/password theo .env. Bảng ở schema campus. Có thể dùng psql trong container mà không cài pgAdmin.

Neon: đọc deploy/neon/README.md. JDBC URL + SSL, user/password chỉ đặt ở backend. Compose mặc định dùng PostgreSQL local; chưa deploy cloud.

Nếu cổng bận, đổi FRONTEND_PORT/BACKEND_PORT/POSTGRES_PORT trong .env. Proxy dev phải khớp backend host port mới. POSTGRES_USER là tài khoản bootstrap local; production cần tài khoản quyền giới hạn.

## Lỗi đã gặp

- Docker báo pipe dockerDesktopLinuxEngine không tồn tại: engine chưa chạy; mở Docker Desktop, đợi rồi dùng docker info.
- Lịch sử: Docker Desktop từng crash ở initializing Inference manager/dockerInference; đã phục hồi socket runtime, stack Compose đã chạy và smoke test đạt. Xem SMOKE_TEST.md.
- npm ERESOLVE do compiler-cli tự chọn patch khác compiler: đã pin cùng 21.0.0; dùng lockfile/npm ci, không dùng --force.
- API 503: xem logs backend/db và kiểm tra schema; không xóa volume khi chưa xác định dữ liệu.

## Lịch sử lỗi runtime Java trên host (đã có cách xử lý)
JAR build được nhưng Java 24 trên máy hiện tại lỗi Unable to establish loopback connection / UnixDomainSockets Invalid argument khi Tomcat khởi động. Chưa xác định nguyên nhân gốc, chưa thay cài đặt Windows. Thử chạy từ PowerShell độc lập với JDK 21 hoặc Docker Java 21 sau khi engine được sửa; chưa xác minh các phương án đó tại đây. Không dùng kết quả build để khẳng định backend đã khởi động.

## Kiểm tra lại sau restart — 03/11/2026
Backend đã khởi động được trên Java 24 khi đặt -Djdk.net.unixdomain.tmpdir vào thư mục target trong project. scripts/start-backend.ps1 đã tự tạo target/socket-tmp và truyền JVM argument này; không cần đổi cài đặt Windows. Frontend proxy gọi backend được, trả 503 khi chưa có PostgreSQL.

Docker gặp socket cũ dạng reparse point ở Docker/run/dockerInference và docker-secrets-engine/engine.sock. Đã dừng Desktop và đổi tên hai thư mục socket để giữ bản sao, không xóa image/volume/database, không factory reset. Bản sao: %LOCALAPPDATA%/Docker/run.backup-20261103-224357 và %LOCALAPPDATA%/docker-secrets-engine.backup-20261103-224459. Trạng thái engine sau xử lý được ghi ở SMOKE_TEST.md.

## Trạng thái mới nhất — 03/11/2026 22:53
Docker Compose đã chạy đủ frontend/backend/PostgreSQL; smoke test đạt. Mở http://localhost:4200 và bấm Kiểm tra kết nối. Các đoạn mô tả chưa chạy được ở trên là lịch sử trước khi phục hồi, không phải trạng thái hiện tại.

Múi giờ thống nhất: Asia/Ho_Chi_Minh (giờ Việt Nam, +07:00). Backend đặt trước khi tạo kết nối JDBC, PostgreSQL dùng timezone và log_timezone theo Compose. Giữ timestamptz để bảo toàn thời điểm. Không dùng alias Asia/Saigon vì image PostgreSQL hiện tại từ chối alias này.

Backend local Windows: dùng ./scripts/start-backend.ps1 để tự nạp .env và đặt thư mục socket tạm; nếu chạy mvn trực tiếp có thể gặp lại lỗi loopback. Không chạy dev server trùng cổng với container: docker compose stop frontend backend trước khi chạy FE/BE local, db giữ nguyên.
