# Migration, danh mục và backup

Các lệnh chạy từ root repo, dùng PowerShell 7 và Python 3.11+. Không chứa mật khẩu thật. Hướng dẫn cloud: [DEPLOYMENT_RECOMMENDATION.md](DEPLOYMENT_RECOMMENDATION.md).

## Database mới

Spring Boot chạy Flyway trước khi phục vụ ứng dụng: V1 tạo schema, V2 cập nhật guard QR. Không chạy baseline SQL thủ công trước nữa. Compose mới không mount init SQL; database trong volume cũ được giữ nguyên.

`campus.flyway_schema_history` lưu version/checksum. Health vẫn kiểm tra đúng 15 bảng nghiệp vụ, không tính bảng metadata. Không sửa V1/V2 sau khi release; thêm V3 trở đi. Flyway `clean` bị khóa. Không bật `baseline-on-migrate` để tự nhận mọi schema không rỗng.

## Nâng cấp volume/database I3 đang có

1. Dừng các tác vụ ghi và sao lưu trước. Nếu backend chưa khởi động được, chỉ cần `docker compose up -d db` để backup.
2. Chạy backup bên dưới, giữ cả file `.dump` và `.sha256` ngoài Git. Nên diễn tập restore trước.
3. Trong `.env` local, đặt `DB_BASELINE_EXISTING=true` một lần, rồi `docker compose up --build -d --wait`. Với backend cloud, đặt biến tương ứng trên backend.
4. Preflight yêu cầu tập bảng/cột trùng layout I3. Nếu thiếu/thừa cột/bảng thì dừng, không reset dữ liệu. Đây là kiểm tra layout; các schema đã tùy biến kiểu dữ liệu/constraint/function cần được đối chiếu riêng trước khi nhận baseline.
5. Sau khi health UP và history ở V2, đặt lại `DB_BASELINE_EXISTING=false`, tạo lại backend và kiểm tra dữ liệu. Không chạy `database/schema/01_schema.sql` lại.

Với nhiều instance, thực hiện bước nhận baseline bằng một instance trong cửa sổ bảo trì. Bản nâng cấp sau dùng migration bổ sung; backup trước các thay đổi dữ liệu. Script SQL cũ trong `database/migrations/` giữ làm tài liệu đối chiếu, không chạy thay Flyway.

## Danh mục dùng thật, không seed tài khoản demo

12 khoa/chương trình do `CatalogInitializer` upsert độc lập khi khởi động. Không xóa khoa cũ hoặc đổi id. Chỉ cần nhập đơn vị tổ chức đã được nhóm chốt. File dưới đây chỉ thêm đơn vị, không tạo user/sự kiện hoặc đổi mật khẩu; chạy lại không nhân bản.

Local Docker:

```powershell
python scripts/seed-catalog.py --docker --unit-name 'Tên đơn vị đã được nhóm chốt'
```

Neon/native: cài client PostgreSQL 17+, đặt `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE=require` trong terminal (hoặc dùng `.pgpass`), rồi:

```powershell
python scripts/seed-catalog.py --unit-name 'Tên đơn vị đã được nhóm chốt'
```

Script gọi psql và đưa tên vào luồng UTF-8, xử lý được tiếng Việt và dấu nháy trên Windows. File SQL có lệnh riêng của psql, không dán nguyên vào Neon SQL Editor. Tên trống/quá 150 ký tự bị từ chối trước khi ghi; database cũng validation trong transaction. Bootstrap Admin bằng biến `CAMPUS_BOOTSTRAP_*` theo [seeds](../database/seeds/README.md); tắt bootstrap sau khi tạo. `CAMPUS_DEV_SEED_ENABLED=false` trên cloud.

## Backup và diễn tập restore

Local Docker dùng client PostgreSQL bên trong container, không cần cài psql trên Windows:

```powershell
python scripts/database-backup.py --docker backup --output .backups/bkevent-before-upgrade.dump
python scripts/database-backup.py --docker restore --input .backups/bkevent-before-upgrade.dump --target-db bkevent_restore_rehearsal
```

Với Neon/native, dùng client PostgreSQL 17+ trên PATH và các biến `PG*` phía trên; bỏ `--docker`:

```powershell
python scripts/database-backup.py backup --output .backups/neon-rehearsal.dump
python scripts/database-backup.py restore --input .backups/neon-rehearsal.dump --target-db bkevent_restore_rehearsal
```

Backup custom-format gồm schema `campus`, dữ liệu, sequence và migration history; không chứa role/quyền sở hữu toàn cluster. Client phải hỗ trợ version server. Script ghi bytes trực tiếp, kiểm SHA-256, không ghi đè file có sẵn. Restore chỉ tạo database MỚI tên `bkevent_restore_*`; nếu đã tồn tại thì dừng, không drop/clean database nguồn. Cần quyền CREATE DATABASE. Trên Neon có thể cần database/branch diễn tập và quyền tương ứng; không dùng database production làm đích.

Sau restore, script kiểm tra 15 bảng và in số user/event/registration/attendance. Đổi cấu hình một backend thử sang database này, tắt mail/bootstrap/dev-seed và kiểm tra đăng nhập, sự kiện, đăng ký, điểm danh, CSV. Giữ nguyên khóa QR nếu cần đọc phiên QR còn hạn. Backup có dữ liệu cá nhân/hash/phiên, lưu ở nơi riêng; `.backups/` và `*.dump` đã được ignore. Chỉ xóa database diễn tập sau khi đối chiếu xong.

CI có bước backup/restore trong PostgreSQL test riêng. Một lần restore local/CI không thay bằng chứng restore trên môi trường cloud thật.

Nếu Docker chưa chạy, có thể chạy thêm bộ I3/nhập danh mục/backup/restore trên PostgreSQL tạm (không dùng database local đang có). Cần Java 21+, Maven, Python 3.11+ và client PostgreSQL 17+ trên PATH:

```powershell
$env:POSTGRES_CLIENT_BIN=Split-Path (Get-Command psql).Source
mvn -f backend/pom.xml -Ppostgres-it '-Dtest=NativeSystemCheck' test
Remove-Item Env:POSTGRES_CLIENT_BIN
```

Runner tạo PostgreSQL riêng trên loopback/cổng ngẫu nhiên, kiểm restart backend bằng cùng khóa QR, khôi phục sang database mới rồi thử đăng nhập/CSV. Binary/server tạm tự dừng; dump/log nằm trong `backend/target/`, không đưa vào Git.

## Rate limit và email

Backend giới hạn trong cửa sổ 5 phút: 300 lần login/IP, 10 lần login/email, 30 lần register/IP. Email được chuẩn hóa và hash cho khóa bộ đếm. Thành công reset bộ đếm email, không reset IP. Trả `429 RATE_LIMITED` kèm `Retry-After`; không khóa tài khoản. Có giới hạn bộ nhớ và kiểm tra đồng thời. Tinh chỉnh bằng `AUTH_LOGIN_IP_LIMIT`, `AUTH_LOGIN_ACCOUNT_LIMIT`, `AUTH_REGISTER_IP_LIMIT`, `AUTH_RATE_WINDOW_SECONDS`, `AUTH_RATE_CAPACITY`; `AUTH_RATE_LIMIT_ENABLED=false` chỉ dùng cho bộ fixtures số lượng lớn.

Đây là bộ đếm trong một process, reset khi restart và không đồng bộ giữa nhiều replica. IP dùng `remoteAddr`, không tin X-Forwarded-For do client tự gửi. Qua proxy, nhiều người có thể chung IP; giới hạn theo email vẫn hoạt động. Trước khi scale nhiều instance, dùng rate limit chia sẻ ở gateway/Redis và cấu hình proxy tin cậy phù hợp.

Outbox vẫn bền vững trong PostgreSQL. Khi rỗng, giãn lần truy vấn từ `MAIL_POLL_MS` đến `MAIL_IDLE_MAX_MS` (mặc định 5 giây → 10 phút). Mail mới trong cùng backend đánh thức sau transaction commit; rollback không đánh thức. Sau khi có việc, giữ nhịp nhanh 10 phút để retry. Khi restart, worker đọc lại outbox; khi chỉ còn rỗng, không truy vấn database mỗi tick scheduler. Mail được tạo ở instance khác có thể đợi đến lần thăm dò tiếp theo; Render Free ngủ thì worker dừng đến khi app thức lại.

Render dùng `/api/live`: chỉ trả UP sau khi app ready, không truy vấn database. `/api/health` vẫn kiểm tra PostgreSQL khi cần chẩn đoán. Polling, traffic, health checks khác và retry đều ảnh hưởng Neon; theo dõi quota thực tế, không cam kết scale-to-zero hoặc gửi mail nền đúng thời điểm trên free tier.
