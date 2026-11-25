# BKevent — môi trường local

Bộ khung chạy được theo thiết kế: Angular 21.2.26 (CLI/build 21.2.29), Spring Boot 3.5.7 (Java 21), PostgreSQL 17, Docker Compose. Đã cập nhật dependency frontend trong đợt rà soát 12/11/2026.

## Lấy mã nguồn và chạy local

Mở Docker Desktop và đợi engine sẵn sàng. PowerShell:

```powershell
git clone https://github.com/giakhang1704/campus_events.git
Set-Location .\campus_events
git switch feature/i3-backend
.\scripts\setup-local.ps1
docker compose up --build -d --wait
.\scripts\smoke\local.ps1
```

Mở http://localhost:4200. Các lệnh sau khi clone đều tính từ thư mục gốc repository, không phụ thuộc đường dẫn máy cá nhân. Nếu đã clone thì mở terminal tại root và bỏ hai lệnh đầu. Khi khởi động lần đầu, đợi backend sẵn sàng trước khi chạy smoke test.

## Bắt đầu
Các lệnh chạy localhost, tài khoản mẫu, PostgreSQL và xử lý lỗi nằm ngay trong README này. API và kiến trúc xem [backend/README.md](backend/README.md); giao diện xem [frontend/README.md](frontend/README.md).

## Thử I3 ngay trên máy

Từ root repository, mở Docker Desktop rồi chạy (cần Python):

```powershell
.\scripts\demo-i3.ps1 -Action Start
.\scripts\demo-i3.ps1 -Action Preview
.\scripts\demo-i3.ps1 -Action Confirm
.\scripts\demo-i3.ps1 -Action Report
.\scripts\demo-i3.ps1 -Action Export
```

Demo có API/PostgreSQL thật ở cổng 18083, QR SVG tại backend/target/i3-demo/qr.svg, database tmpfs riêng và mail tắt. Preview chưa ghi điểm danh; Confirm mới ghi PRESENT. Có thêm ManualPresent/ManualClear (kèm -Reason), History, Close, Refresh (-DurationMinutes 1–30) và Stop. Đây là test bằng lệnh, chưa có camera trên giao diện. Hướng dẫn và các ca thử âm: [I3_MANUAL.md](docs/testing/I3_MANUAL.md).

Chạy toàn bộ test backend I3 bằng `./scripts/test-i3.ps1`: API test riêng ở 18082, không đụng volume local. Dừng/reset demo bằng `./scripts/demo-i3.ps1 -Action Stop` rồi Start lại. Tài khoản/khóa thử tự sinh trong target và không commit Git.

## Phạm vi
- Angular hiển thị kiểm tra kết nối môi trường qua API thật /api/health. Backend truy vấn PostgreSQL thật và xác nhận 15 bảng trong schema campus.
- Tài khoản, đăng nhập/đăng xuất, quản trị người dùng và Organizer tạo/sửa/công bố sự kiện đã có màn hình Angular gọi API thật. Cookie HttpOnly + CSRF, phiên lưu PostgreSQL. Sinh viên đã có màn Angular tìm/xem sự kiện gọi API thật. Mockup localStorage chỉ có trong dev server hoặc server tham khảo riêng, không chứa trong build production/Docker.
- Schema giữ một dòng đăng ký/student/event; hủy giữ attendance, đăng ký lại tự reset có snapshot audit trong cùng transaction.
- Backend I2 có API đăng ký/hủy, FIFO, danh sách đăng ký và email Brevo qua outbox. Frontend I2 đã nối API: đăng ký/danh sách chờ/hủy ở chi tiết sự kiện, Sự kiện của tôi và Người tham gia. Xem [API và cấu hình I2](backend/README.md#i2-api).
- Backend I3 thêm QR thật, điểm danh thủ công có lịch sử, báo cáo và CSV. Student quét QR do Organizer hiển thị; mở từ 30 phút trước starts_at. Frontend I3 đang tích hợp. Xem [API I3](docs/api/I3.md).
- Mockup làm việc có một lượt điểm danh, ends_at, giới hạn nhiều khoa/năm, sức chứa nguyên dương, bảo vệ Admin và CSV. Phần ngoài phạm vi giữ bằng comment/tạm vô hiệu hóa. Bản mockup làm việc vẫn nằm trong frontend/public/mockup.

## Cấu trúc
```text
frontend/         Angular, Dockerfile, nginx proxy; public/mockup là bản xem trước
backend/          Spring Boot, Dockerfile; module nghiệp vụ và API môi trường
database/         schema, queries, tests, migrations, seeds
deploy/           neon, vercel, lightsail
scripts/smoke/    kiểm tra HTTP và mockup
docs/             API, kiến trúc, quyết định phạm vi, tài liệu và kết quả kiểm thử
compose.yaml      stack local, cổng chỉ bind 127.0.0.1
.env.example      mẫu cấu hình Compose
```

## Kiểm chứng
Đã chạy 29 unit test, HTTP/PostgreSQL I2, regression I1 gồm browser và smoke localhost trên phiên bản backend I2 ngày 12/11/2026: PASS. Kịch bản kiểm thử được giữ trong backend/src/test và scripts/. Chưa deploy cloud hoặc xác nhận A03/RA02/A11/CP2.

## Nguyên tắc
Không commit secret; Compose nạp .env, Spring Boot không tự đọc .env. Schema init chỉ chạy trên volume rỗng. Không dùng down -v với dữ liệu cần giữ. Không mặc định bảng nguồn trong references là schema hiện hành.

## Trạng thái kiểm tra mới nhất

Audit 18/11/2026: 43 unit test, I3 và regression backend I1/I2 PASS. Bổ sung preview read-only và version khi xác nhận để chặn thao tác cũ; tăng cường guard tại DB cho đúng hạn QR/ends_at và lỗi 409; thêm demo từng bước. Database cũ cần chạy [migration hàm guard](database/migrations/README.md). [API I3](docs/api/I3.md) · [Hướng dẫn test thủ công](docs/testing/I3_MANUAL.md).

18/11/2026: backend I3, 39 unit test, HTTP/PostgreSQL I3, regression backend I1/I2 và smoke localhost PASS. QR theo luồng Student quét mã Organizer, mở trước bắt đầu tối đa 30 phút; báo cáo/CSV có API thật. Giao diện I2/I3 còn chờ nối API. [Kết quả I3](docs/testing/I3_RESULTS.md).

12/11/2026: backend I2, 29 unit test, HTTP/PostgreSQL I2, regression I1 (gồm browser) và smoke localhost PASS. Backend mới đã chạy local; gửi email thật đang tắt. Endpoint, cấu hình và giới hạn nằm trong [backend README](backend/README.md#i2-api). Đoạn dưới lưu trạng thái khởi tạo trước đây.

03/11/2026 22:53 giờ Việt Nam: toàn bộ stack Compose đang chạy, FE -> BE -> PostgreSQL smoke test PASS. Múi giờ backend/database: Asia/Ho_Chi_Minh (+07:00). Mở http://localhost:4200. Lần sau dùng docker compose up -d; dừng bằng docker compose down (giữ volume). Đã bổ sung API tài khoản trên nhánh I1; Luồng Organizer của A05.2 đã triển khai; API tìm/xem đã có; FE Sinh viên và cloud deploy chưa hoàn thành.

## Checklist Increment 1

Phạm vi đối chiếu theo Bảng 23, Bảng 33 và checkpoint CP1 trong báo cáo `main (8).pdf` (tài liệu nhóm ngoài repository). Các task dưới đây là cách chia nhỏ công việc, **không cộng thêm giờ vào kế hoạch**. Checkbox chỉ đánh dấu theo kết quả triển khai/kiểm tra, không thay phê duyệt độc lập.

### 1. Chuẩn bị hợp đồng API và dữ liệu

- [x] Chốt request/response, mã lỗi và phân quyền cho API tài khoản/sự kiện.
- [x] Chốt cơ chế đăng nhập, lưu phiên và thu hồi phiên.
- [x] Chuẩn bị dữ liệu thử I1: khoa, đơn vị, ba vai trò, tài khoản khóa, sự kiện nháp/công bố.
- [x] Có cách tạo Admin đầu tiên; mật khẩu phải hash, không lưu mật khẩu thật trong Git.
- [x] Viết acceptance criteria và test case I1 — A02.1.
- [x] Seed dữ liệu phát triển có hướng dẫn chạy, không tự xóa dữ liệu — A04.1.

### 2. A05.1 — Tài khoản và phân quyền

- [x] Đăng ký sinh viên: users/student_profiles cùng transaction, chống trùng email/MSSV.
- [x] Đăng nhập: mật khẩu hash, trạng thái tài khoản, tạo phiên.
- [x] Đăng xuất: thu hồi phiên ở backend.
- [x] Lấy người đang đăng nhập: vai trò và thông tin hiển thị.
- [x] Phân quyền ba vai trò: backend kiểm tra API, frontend hiển thị phù hợp.
- [x] Quản lý tài khoản: tra cứu, cấp organizer, khóa/mở; mỗi tài khoản có một vai trò cố định.
- [x] Bảo vệ Admin: không tự khóa, giữ Admin ACTIVE cuối cùng.
- [x] Thu hồi phiên ngay khi khóa tài khoản hoặc đổi mật khẩu.
- [x] Angular: thay màn hình tài khoản mô phỏng bằng form gọi API thật.

Kiểm tra quyền trên frontend chỉ hỗ trợ giao diện; backend phải chặn request trái quyền.

### 3. A05.2 — Quản lý và tìm/xem sự kiện

- [x] Danh mục khoa/đơn vị phục vụ form sự kiện.
- [x] Tạo sự kiện nháp: lưu DB, gắn người tổ chức hiện tại.
- [x] Sửa sự kiện: chỉ chủ quản lý, kiểm tra version tránh ghi đè.
- [x] Công bố: kiểm tra đủ dữ liệu/thời gian hợp lệ.
- [x] Danh sách người tổ chức: chỉ sự kiện thuộc quyền quản lý.
- [x] Backend danh sách sự kiện đã công bố: PUBLISHED, phân trang.
- [x] Backend tìm theo tên; trả danh sách rỗng khi không có kết quả.
- [x] Backend chi tiết: thời gian, địa điểm, sức chứa, điều kiện tham gia; nháp/không tồn tại trả 404.
- [x] Chọn nhiều khoa/năm; không chọn nghĩa là tất cả.
- [x] Validation: sức chứa nguyên dương; mở đăng ký < đóng đăng ký <= bắt đầu < kết thúc.
- [x] Angular: Organizer dùng danh sách, form và xác nhận công bố gọi API thật.
- [x] Angular: Sinh viên tìm và xem sự kiện qua API thật.
- [x] Loading, lỗi, rỗng, thông báo lưu và xử lý conflict ở màn Organizer.

Kết thúc theo ends_at; loại sự kiện vẫn tạm vô hiệu hóa.

### 4. A06 — Tích hợp, kiểm thử và sửa lỗi

- [ ] Đăng ký tài khoản -> đăng nhập -> đăng xuất.
- [ ] Tài khoản khóa và phiên bị thu hồi.
- [ ] API trái quyền khi gọi trực tiếp ngoài giao diện.
- [ ] Admin cuối cùng, gồm hai thao tác quản trị đồng thời.
- [ ] Tạo -> sửa -> công bố -> tìm -> xem sự kiện.
- [ ] Organizer không xem/sửa dữ liệu ngoài quyền.
- [ ] Validation, email/MSSV trùng và xung đột cập nhật.
- [ ] Reload vẫn lấy dữ liệu PostgreSQL.
- [ ] Test log, lỗi đã sửa, retest, commit/build được kiểm tra.
- [ ] README có tài khoản thử/luồng demo, không có bí mật thật.

### 5. Demo và đóng I1 — CP1

```text
Admin cấp tài khoản người tổ chức
-> Người tổ chức đăng nhập
-> Tạo, sửa và công bố sự kiện
-> Sinh viên đăng ký tài khoản, đăng nhập
-> Tìm và xem chi tiết sự kiện
-> Thử truy cập trái quyền để chứng minh bị chặn
```

- [ ] Test I1 đạt; không còn lỗi nghiêm trọng chặn luồng chính.
- [ ] Có evidence, biên bản demo, phản hồi và hoàn thành RA06 làm rõ yêu cầu kỹ thuật.
- [ ] Đối chiếu RA02 riêng: nếu đổi hosting thì ghi nhận thay đổi, không đánh dấu đã thử Lightsail.

## Tài liệu I1 và cách dùng

Kiến trúc/API: [backend/README.md](backend/README.md). Seed/bootstrap và tài khoản thử: [database/seeds/README.md](database/seeds/README.md). Kịch bản kiểm tra HTTP/UI nằm trong scripts/smoke/; unit test nằm trong backend/src/test/.

Sau khi build stack, chạy `./scripts/seed-local.ps1` để tạo dữ liệu local opt-in, không ghi đè tài khoản có sẵn. Mật khẩu ở DEV_SEED_PASSWORD trong .env, không in/commit. Đợi backend seed xong rồi đăng nhập admin.i1@example.test hoặc student.i1@example.test. Organizer được cấp qua API phải đổi mật khẩu lần đầu.

Kiểm thử độc lập: `./scripts/test-i1.ps1` (Docker + Python). Tạo project campus-events-i1-test, DB tmpfs riêng và API cổng 18080; không dùng volume local. Kết thúc có thể chạy `docker compose -p campus-events-i1-test -f compose.i1-test.yaml down` trong cùng terminal còn TEST_DB_PASSWORD/TEST_ACCOUNT_PASSWORD. Khởi động lại test sẽ reset **chỉ database kiểm thử tạm thời**.

Workflow Git theo báo cáo mục 1.7.2: feature branch + Pull Request, ít nhất một người khác review, người tạo không tự approve. Conventional Commits là quy ước đề xuất, không phải yêu cầu được ghi trong báo cáo. Nhánh I1 không tự merge vào main.

### Kết quả task 1 và A05.1
Đã triển khai và tự kiểm thử. Các checkbox hoàn thành là trạng thái triển khai/tự kiểm tra, chưa thay review độc lập của nhóm. Luồng Organizer và tìm/xem của Sinh viên đã dùng API thật; A06 và CP1 vẫn cần đối chiếu bằng chứng/biên bản của nhóm.

## Backend sau refactor I2

Backend tổ chức theo tầng Controller → Service interface/implementation → Repository interface/JDBC implementation. Xem [backend/README.md](backend/README.md) để đọc tree, cơ chế transaction, luồng xử lý và lệnh chạy. Giữ nguyên API/database; refactor chưa bổ sung chức năng đăng ký sự kiện của I2.

Chưa deploy cloud. Nhánh `feature/i3-scan-frontend` kế thừa I1/I2, backend I3, màn Organizer điểm danh/báo cáo và màn sinh viên quét QR. Local đã bổ sung kết quả điểm danh trên trang chi tiết. Trạng thái nhánh, phần còn thiếu và đề xuất triển khai: [rà soát 25/11/2026](docs/testing/SYSTEM_REVIEW_2026-11-25.md). Dependency frontend tại lần rà soát 12/11/2026: audit production 0 cảnh báo, audit đầy đủ còn 16 moderate trong toolchain CLI, không có high/critical.

## Increment 2 — backend

Triển khai trên `feature/i2-backend`, tiếp tục kiến trúc phân tầng của nhánh refactor. Checklist dưới đây phản ánh phạm vi backend, chưa đóng CP2 hay thay review độc lập của nhóm.

- [x] A07.1: API đăng ký/hủy, kiểm tra vai trò/khoa/năm/thời hạn, danh sách cá nhân và danh sách người tham gia thuộc Organizer.
- [x] A07.1: sức chứa, chống đăng ký trùng/đồng thời, version khi hủy và một dòng hiện hành; đăng ký lại reset điểm danh có lịch sử.
- [x] A07.2: đôn FIFO người hợp lệ khi hủy/tăng sức chứa; tiếp tục sau đóng đăng ký đến trước bắt đầu; không để người mới vượt người chờ cũ hợp lệ.
- [x] A07.3: email xác nhận/đôn chờ/thay đổi lịch hoặc địa điểm qua Brevo HTTP; outbox nguyên tử, retry hữu hạn, lease và dedupe; tắt gửi thật mặc định.
- [x] A08 phần backend: unit/integration I2, regression I1 và smoke local; xem log/kịch bản trong tài liệu kết quả.
- [x] Frontend I2: nối API đăng ký/hủy, danh sách của tôi/người tham gia và các trạng thái giao diện; kiểm thử trình duyệt `scripts/smoke/i2_ui.cjs`.
- [ ] A08/CP2: demo/biên bản/phản hồi và review độc lập.

Từ root repository:

```powershell
mvn -f backend/pom.xml test
./scripts/test-i2.ps1
docker compose up --build -d --wait backend
./scripts/smoke/local.ps1
```

I2 test có PostgreSQL tmpfs riêng (không dùng volume local) và mail giả lập (không gửi thư thật). Endpoint, lỗi, cấu hình `.env`, truy vấn outbox và cách dừng test: [backend/README.md](backend/README.md#i2-api). QR/CSV/nhắc lịch chưa thuộc bản backend này.

## Increment 3 — backend

- [x] A09.1: tạo/đọc/đóng phiên, QR SVG thật; xác thực session/token và đăng ký chính thức; check-in idempotent cho Student trong phiên đăng nhập.
- [x] A09.2: Organizer phụ trách ghi/chỉnh thủ công, lý do bắt buộc, hai version và history nguyên tử; tương thích reset khi đăng ký lại I2.
- [x] A10.1: summary/chi tiết phân trang, tỷ lệ chỉ tính REGISTERED, vắng suy ra sau ends_at, không chia cho 0.
- [x] A10.2: CSV UTF-8 BOM, escape nội dung/công thức, số liệu cùng snapshot; giới hạn 10.000 dòng/export có thông báo rõ.
- [x] Kiểm thử backend I3, regression I1/I2 và Docker localhost; không reset volume phát triển hoặc gửi email thật.
- [x] Frontend I2: đăng ký/hủy, danh sách cá nhân và người tham gia đã nối API.
- [x] Frontend I3 Organizer: phiên QR/điểm danh thủ công/lịch sử; màn báo cáo có thống kê, chi tiết phân trang và CSV theo bộ lọc.
- [x] Frontend I3 Student: camera/scan QR; local bổ sung trạng thái điểm danh ở chi tiết sự kiện.
- [ ] Demo đầu cuối, kiểm thử trên điện thoại thật qua HTTPS và review độc lập.
- [ ] A11/A12: deployment/restore, QA/review và các checkpoint CP3/CP4 theo báo cáo; chưa đánh dấu đã thử Lightsail.

```powershell
mvn -f backend/pom.xml test
./scripts/test-i3.ps1
```

API test tại localhost:18082 dùng project/DB tmpfs riêng, không dùng database local. [API/cấu hình I3](docs/api/I3.md), [kết quả và giới hạn](docs/testing/I3_RESULTS.md). Các task là phần chia nhỏ từ kế hoạch, không cộng thêm giờ.

Kiểm thử màn **Báo cáo + CSV** bằng trình duyệt thật, từ root repository (Docker Desktop đang chạy, Node 24 và Microsoft Edge):

```powershell
npm.cmd ci --prefix frontend
npm.cmd ci --prefix scripts/smoke
./scripts/test-i3-reports.ps1
```

API 18084, Angular 14204 và PostgreSQL tmpfs riêng; tự dừng sau test, không đụng database local hoặc gửi email thật. Cách xem giao diện, các ca thử và bằng chứng: [I3_REPORTS_UI.md](docs/testing/I3_REPORTS_UI.md).

## Chạy từng phần, PostgreSQL và mockup

Phần backend I3 dùng cùng stack và 15 bảng hiện có. Chạy `./scripts/setup-local.ps1` để sinh ATTENDANCE_TOKEN_KEY nếu chưa có, `./scripts/migrate-local.ps1` để nâng cấp hàm guard mà giữ dữ liệu, rồi `docker compose up --build -d --wait` và smoke test. Script giữ nguyên khóa/mật khẩu đã tồn tại. Khóa QR chỉ nằm ở backend và cần ổn định khi restart/deploy. Chi tiết: [API I3](docs/api/I3.md).

Cần Node 24, JDK tương thích target 21 và Maven 3.9+ nếu chạy ngoài Docker. Từ root, dùng các terminal riêng:

```powershell
# Dừng FE/BE container để tránh trùng cổng; giữ DB.
docker compose stop frontend backend
docker compose up -d db
./scripts/start-backend.ps1
```

```powershell
Set-Location ./frontend
npm.cmd ci
npm.cmd start
```

Sau khi đổi nhánh/pull có thay lockfile, chạy npm ci để đồng bộ node_modules. Proxy Angular mặc định gọi localhost:8080. Build từ root: `mvn -f backend/pom.xml package`; build frontend trong frontend/ bằng `npm.cmd run build`.

pgAdmin/DBeaver kết nối host localhost, port POSTGRES_PORT (5432), database/user/password theo `.env`, bảng ở schema campus. Không cần cài PostgreSQL trên Windows khi dùng container. Kiểm tra bằng terminal:

```powershell
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id,title,starts_at FROM campus.events ORDER BY id;"'
```

Xem mockup độc lập, không dùng database:

```powershell
python -m http.server 4201 --bind 127.0.0.1 --directory ./frontend/public
```

Mở http://localhost:4201/mockup/index.html, dừng bằng Ctrl+C. Dev server Angular cũng có `/mockup/index.html`; build production/Docker trả 404 cho mockup.

## Cấu hình local và xử lý lỗi

- setup-local.ps1 tạo `.env` và mật khẩu local nếu chưa có; giữ nguyên file đã tồn tại. Compose đọc `.env`; Spring Boot không tự đọc file này. Khi chạy Maven trên host, start-backend.ps1 nạp các khóa được hỗ trợ và xử lý thư mục socket tạm của Java trên Windows.
- Dừng stack bằng `docker compose down`, chạy lại bằng `docker compose up -d`. Không dùng `down -v` với dữ liệu cần giữ. Baseline schema chỉ khởi tạo trên volume rỗng; thay file SQL không nâng cấp DB cũ. I2 không cần đổi schema.
- Docker báo pipe/engine không tồn tại: mở Docker Desktop, chọn Linux containers, đợi engine running rồi chạy docker info. Cổng bận: đổi FRONTEND_PORT/BACKEND_PORT/POSTGRES_PORT trong `.env`, đồng bộ proxy nếu chạy Angular dev.
- API 503: xem `docker compose logs --tail 100 backend db`; kiểm tra schema/kết nối trước khi sửa dữ liệu. Thiếu package Angular sau đổi nhánh: dùng npm ci, không xóa import để né lỗi.
- Múi giờ backend/database Asia/Ho_Chi_Minh (+07:00); API dùng timestamp có offset. Không để database password hoặc Brevo key trong frontend/Git.

Tài liệu chi tiết được giữ trong docs/, gồm [API I2](docs/api/I2.md) và [kết quả kiểm thử](docs/testing/I2_RESULTS.md). Hướng dẫn dùng chung cũng nằm trong các README. Phương án cloud xem [Neon](deploy/neon/README.md) và [Vercel](deploy/vercel/README.md); chưa có bằng chứng đã deploy cloud.
