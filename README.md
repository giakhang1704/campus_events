# Campus Events — môi trường local

Bộ khung chạy được theo thiết kế: Angular 21.0.0, Spring Boot 3.5.7 (Java 21), PostgreSQL 17, Docker Compose. Đây là các phiên bản khởi tạo mới; không thay phiên bản ứng dụng cũ.

## Lấy mã nguồn và chạy local

Mở Docker Desktop và đợi engine sẵn sàng. PowerShell:

```powershell
git clone https://github.com/giakhang1704/campus_events.git
Set-Location .\campus_events
.\scripts\setup-local.ps1
docker compose up --build -d
.\scripts\smoke\local.ps1
```

Mở http://localhost:4200. Các lệnh sau khi clone đều tính từ thư mục gốc repository, không phụ thuộc đường dẫn máy cá nhân. Nếu đã clone thì mở terminal tại root và bỏ hai lệnh đầu. Khi khởi động lần đầu, đợi backend sẵn sàng trước khi chạy smoke test.

## Bắt đầu
Đọc **[hướng dẫn chạy localhost](docs/environment/LOCAL_RUN.md)**: cách tạo .env, docker compose up --build -d, truy cập http://localhost:4200, chạy dev từng phần, pgAdmin và xử lý lỗi.

## Phạm vi
- Angular hiển thị kiểm tra kết nối môi trường qua API thật /api/health. Backend truy vấn PostgreSQL thật và xác nhận 15 bảng trong schema campus.
- Tài khoản, đăng nhập/đăng xuất, quản trị người dùng và Organizer tạo/sửa/công bố sự kiện đã có màn hình Angular gọi API thật. Cookie HttpOnly + CSRF, phiên lưu PostgreSQL. Nút Xem mockup vẫn giữ bản localStorage cho phần chưa tích hợp; các chức năng trong khung chỉ mô phỏng; API Sinh viên tìm/xem đã có; màn Angular tương ứng chưa tích hợp.
- Schema giữ một dòng đăng ký/student/event; hủy giữ attendance, đăng ký lại tự reset có snapshot audit trong cùng transaction.
- Mockup làm việc có một lượt điểm danh, ends_at, giới hạn nhiều khoa/năm, sức chứa nguyên dương, bảo vệ Admin và CSV. Nguồn cũ giữ nguyên trong docs/references; mã thay thế được comment, không xóa.

## Cấu trúc
```text
frontend/         Angular, Dockerfile, nginx proxy; public/mockup là bản xem trước
backend/          Spring Boot, Dockerfile; module nghiệp vụ và API môi trường
database/         schema, queries, tests, migrations, seeds
deploy/           neon, vercel, lightsail
scripts/smoke/    kiểm tra HTTP và mockup
docs/             architecture, decisions, design, environment, references
compose.yaml      stack local, cổng chỉ bind 127.0.0.1
.env.example      mẫu cấu hình Compose
```

## Kiểm chứng
Xem docs/environment/SMOKE_TEST.md. Có cấu hình không đồng nghĩa đã chạy. Chưa deploy cloud, chưa xác nhận toàn bộ A03/RA02/A11.

## Nguyên tắc
Không commit secret; Compose nạp .env, Spring Boot không tự đọc .env. Schema init chỉ chạy trên volume rỗng. Không dùng down -v với dữ liệu cần giữ. Không mặc định bảng nguồn trong references là schema hiện hành.

## Trạng thái kiểm tra mới nhất
03/11/2026 22:53 giờ Việt Nam: toàn bộ stack Compose đang chạy, FE -> BE -> PostgreSQL smoke test PASS. Múi giờ backend/database: Asia/Ho_Chi_Minh (+07:00). Mở http://localhost:4200. Lần sau dùng docker compose up -d; dừng bằng docker compose down (giữ volume). Đã bổ sung API tài khoản trên nhánh I1; Luồng Organizer của A05.2 đã triển khai; API tìm/xem đã có; FE Sinh viên và cloud deploy chưa hoàn thành.

## Checklist Increment 1

Phạm vi đối chiếu theo Bảng 23, Bảng 33 và checkpoint CP1 trong báo cáo `main (3).pdf` (tài liệu nhóm ngoài repository). Các task dưới đây là cách chia nhỏ công việc, **không cộng thêm giờ vào kế hoạch**. Checkbox chỉ đánh dấu theo kết quả triển khai/kiểm tra, không thay phê duyệt độc lập.

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
- [ ] Angular: Sinh viên tìm và xem sự kiện qua API thật.
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

Hợp đồng API: [docs/api/I1.md](docs/api/I1.md). Acceptance/test cases: [docs/testing/I1_ACCEPTANCE.md](docs/testing/I1_ACCEPTANCE.md). Seed/bootstrap: [database/seeds/README.md](database/seeds/README.md).

Sau khi build stack, chạy `./scripts/seed-local.ps1` để tạo dữ liệu local opt-in, không ghi đè tài khoản có sẵn. Mật khẩu ở DEV_SEED_PASSWORD trong .env, không in/commit. Đợi backend seed xong rồi đăng nhập admin.i1@example.test hoặc student.i1@example.test. Organizer được cấp qua API phải đổi mật khẩu lần đầu.

Kiểm thử độc lập: `./scripts/test-i1.ps1` (Docker + Python). Tạo project campus-events-i1-test, DB tmpfs riêng và API cổng 18080; không dùng volume local. Kết thúc có thể chạy `docker compose -p campus-events-i1-test -f compose.i1-test.yaml down` trong cùng terminal còn TEST_DB_PASSWORD/TEST_ACCOUNT_PASSWORD. Khởi động lại test sẽ reset **chỉ database kiểm thử tạm thời**.

Workflow Git theo báo cáo mục 1.7.2: feature branch + Pull Request, ít nhất một người khác review, người tạo không tự approve. Conventional Commits là quy ước đề xuất, không phải yêu cầu được ghi trong báo cáo. Nhánh I1 không tự merge vào main.

### Kết quả task 1 và A05.1
Đã triển khai và tự kiểm thử; bằng chứng ở [I1_RESULTS.md](docs/testing/I1_RESULTS.md). Các checkbox hoàn thành là trạng thái triển khai/tự kiểm tra, chưa thay review độc lập của nhóm. Luồng tạo/sửa/công bố và danh sách riêng của Organizer đã có API thật. Backend tìm/xem sự kiện đã có; FE Sinh viên, toàn bộ A06 và CP1 chưa được xác nhận hoàn tất.
