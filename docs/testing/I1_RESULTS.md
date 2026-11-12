# Kết quả kiểm thử Increment 1

## Mới nhất — Backend tìm/xem sự kiện UC-04–05 ngày 04/11/2026

Đã triển khai GET /api/events (q/page/size) và GET /api/events/{id}. Chỉ đọc PUBLISHED, dùng chung cho tài khoản đã đăng nhập; không có ngoại lệ xem nháp cho Admin hoặc chủ sở hữu tại hai route này. Organizer xem nháp qua route quản lý riêng. Dữ liệu truy vấn PostgreSQL theo lớp Controller–Service–Repository, không thay schema.

Kiểm chứng trên mã nguồn hiện tại:

- Build Docker backend `mvn package`: PASS, 17 unit test (EventRulesTest 6, EventServiceTest 5, EventReadServiceTest 6), không bỏ qua test.
- `scripts/test-i1.ps1`: PASS toàn bộ HTTP/PostgreSQL của tài khoản, Organizer và các API đọc mới, dùng database tmpfs riêng.
- Kiểm tra API: đăng nhập bắt buộc; mật khẩu tạm bị chặn; Student/Organizer/Admin chỉ nhận PUBLISHED; truy cập nháp và ID không tồn tại trả cùng 404, chủ nháp vẫn xem được qua route riêng.
- Tìm kiếm Unicode/hoa-thường, trim khoảng trắng, tìm literal ký tự %, _, ! và chuỗi SQL giả lập đều PASS. Không nhận status/includeDrafts từ query để thay phạm vi đọc.
- Phân trang PASS: thứ tự starts_at/id ổn định khi các sự kiện trùng giờ bắt đầu, không trùng hoặc bỏ dòng trong dữ liệu tĩnh, hasNext đúng, kết quả rỗng/vượt trang trả 200.
- Chi tiết đủ nội dung/lịch/đơn vị/sức chứa/khoa/năm; không lọc quyền xem theo điều kiện tham gia. Query/path sai kiểu hoặc vượt giới hạn trả JSON 400, không lộ SQL/stacktrace.
- GET không đổi event/version hoặc tạo registrations; lần đọc sau phản ánh bản chỉnh sửa đã lưu. Các trường và mảng điều kiện được đọc trong cùng transaction snapshot REPEATABLE_READ.
- Đã cập nhật backend local, đăng nhập tài khoản Sinh viên mẫu trên Edge và gọi API qua Nginx localhost:4200: danh sách/chi tiết 200, chỉ PUBLISHED, ID không tồn tại 404.

Lần này chỉ triển khai backend; FE Sinh viên chưa tích hợp và chưa chạy lại toàn bộ bộ kiểm thử UI. Chưa thay QA/review độc lập, chưa đánh dấu toàn I1 hoặc CP1 hoàn tất.

## Danh mục 12 khoa/chương trình — 04/11/2026

Đã thay danh mục mẫu bằng đúng 12 tên/thứ tự người dùng cung cấp, gồm PFIEV. `CatalogInitializer` đồng bộ dữ liệu tham chiếu độc lập với dev seed; upsert theo code giữ ID và dữ liệu liên kết, không xóa dòng cũ. API chỉ trả lựa chọn hiện hành; đăng ký và giới hạn sự kiện kiểm tra mã thuộc danh mục này.

PASS: build backend và 11 unit test; bộ HTTP/PostgreSQL kiểm tra tên/thứ tự, 12 ID riêng biệt, không nhận khoa legacy, restart không đổi ID hoặc xóa dòng cũ; bộ Edge regression tài khoản/sự kiện. Đã cập nhật backend local và kiểm tra Edge tại localhost:4200: form có 12 lựa chọn theo thứ tự, chọn được CT KỸ SƯ CHẤT LƯỢNG CAO PFIEV. Ảnh local trong frontend/.angular, không commit.

## Organizer tạo, sửa và công bố sự kiện ngày 04/11/2026

Đã triển khai UC-12–14 cho Organizer: tạo DRAFT với đủ trường cơ bản, tải/sửa sự kiện mình phụ trách, xem trước và xác nhận công bố PUBLISHED. Có danh sách riêng/phân trang để mở sự kiện cần sửa. Sinh viên tìm/xem qua API vẫn chưa triển khai; chưa đánh dấu toàn A05.2, A06 hoặc CP1 hoàn tất.

Kiến trúc module events: Controller nhận DTO; Service giữ transaction, ownership và version; EventRules kiểm tra nghiệp vụ thuần; Repository chứa SQL và đọc khoa/năm theo lô. Snapshot model bất biến không phụ thuộc DTO HTTP. Frontend tách EventApi, kiểu dữ liệu/chuyển đổi thời gian, component danh sách và component form; HTML riêng. Không cần thay schema hoặc reset DB.

Kiểm chứng trên mã nguồn sau cùng:

- Docker backend `mvn package`: PASS, 11 unit test (EventRulesTest 6, EventServiceTest 5), không bỏ qua test trong Dockerfile.
- Angular `npm.cmd run build`: PASS.
- `scripts/test-i1.ps1 -PlaywrightModule "$env:TEMP/campus-i1-ui/node_modules/playwright"`: PASS cả HTTP/PostgreSQL và Edge; vẫn dùng database tmpfs/project test riêng, không đổi dữ liệu local.
- HTTP sự kiện: tạo/sửa/công bố, reload từ PostgreSQL, giới hạn khoa/năm được thay thế nguyên tử; payload giả organizerId/status không đổi chủ/trạng thái; Admin/Student, mật khẩu tạm và thiếu CSRF bị chặn; Organizer khác không đọc/sửa/công bố được; dữ liệu thiếu/sai thời gian, offset, số thập phân, khoa/năm trùng hoặc không tồn tại bị từ chối.
- Phân trang chỉ chứa sự kiện của chủ sở hữu, thứ tự id giảm dần. Hai yêu cầu cùng version: đúng một thành công, một VERSION_CONFLICT, không ghi đè. Công bố lại giữ version/publishedAt; chưa đến giờ đăng ký vẫn công bố được, không tạo registrations.
- Với fixture đã Registered: đổi thời gian/địa điểm hoặc điều kiện đối tượng bị chặn và sự kiện giữ nguyên. Các quy tắc giảm sức chứa/tăng khi có Waitlisted có unit test; xử lý thông báo/FIFO hoàn chỉnh vẫn thuộc I2.
- Edge: form validation, tạo/hủy nháp, sửa, giữ nội dung chưa lưu khi hai tab xung đột, tải lại bản mới bằng thao tác rõ ràng, xem trước/hủy/xác nhận công bố và dữ liệu sau reload đều PASS. Kiểm tra mobile 390 px không tràn ngang toàn trang. Bộ regression tài khoản/vai trò cố định cũng PASS.
- Đã xem ảnh form mobile và màn xác nhận công bố trong `frontend/.angular` (không commit). Giờ nhập/hiển thị là Việt Nam +07:00.

Giới hạn: thay đổi quan trọng khi đã có Registered cần tích hợp thông báo; tăng sức chứa khi có Waitlisted cần đôn FIFO cùng transaction, hiện trả 409 thay vì thực hiện một phần. Chưa có API danh sách/chi tiết sự kiện cho Sinh viên, chưa có email thật hoặc đăng ký tham gia. Kết quả này chưa thay QA/review độc lập.

## Hiện tại — vai trò cố định ngày 04/11/2026

Theo yêu cầu người dùng, đã bỏ UC-24. Mỗi tài khoản giữ một vai trò cố định: sinh viên tự đăng ký STUDENT, Admin cấp ORGANIZER, Admin được thiết lập khi triển khai. Đã gỡ form/nút đổi vai trò trong Angular và mockup, gỡ controller/service đổi vai trò và preview; đường dẫn cũ bị chặn 403 kể cả Admin. Khóa/mở, lọc tài khoản và phân quyền ba nhóm tiếp tục hoạt động. Quyết định được ghi trong `docs/decisions/SCOPE.md`; các kết quả có đổi vai trò bên dưới chỉ là lịch sử của phiên bản trước quyết định này.

Kiểm chứng sau thay đổi:

- Backend build Java 21 trong Docker: PASS.
- Angular `npm.cmd run build`: PASS.
- `scripts/test-i1.ps1 -PlaywrightModule "$env:TEMP/campus-i1-ui/node_modules/playwright"`: PASS HTTP/PostgreSQL và Edge trên project test riêng.
- HTTP: API đổi vai trò/preview cũ trả 403, user/version/audit/phiên không đổi; tự đăng ký gửi role=ADMIN vẫn STUDENT; cấp Organizer gửi role=ADMIN vẫn ORGANIZER; gửi role=ADMIN qua khóa/mở không đổi vai trò. Khóa/mở vẫn thu hồi phiên, không tự khóa, giữ Admin ACTIVE cuối và chống version cũ.
- Edge: không có nút đổi vai trò; tạo Organizer, xem trước/xác nhận/hủy khóa, mở khóa, đổi mật khẩu lần đầu, đăng ký/đăng nhập, logout mất mạng và mobile đều PASS.
- `node scripts/smoke/mockup.cjs`: PASS, gồm không hiển thị đổi vai trò và gọi trực tiếp thao tác role không đổi dữ liệu mockup.

Đây là kết quả kiểm thử khi triển khai, chưa thay review/QA độc lập. Các giới hạn về xác minh danh tính, bàn giao ngoài ứng dụng và lỗi gián đoạn database ghi bên dưới vẫn áp dụng.

## Lịch sử trước quyết định bỏ UC-24 — đối chiếu ngày 04/11/2026

Đã bổ sung các điểm còn lệch ở UC-01–03 và UC-21–24: lỗi theo trường/hướng dẫn khi trùng, thông báo đăng nhập và gián đoạn dịch vụ, logout phiên hết hạn/mất mạng, lọc vai trò/trạng thái, xác nhận cấp Organizer, xem trước trước/sau và tác động khi khóa/đổi quyền. API lưu vẫn kiểm tra lại quyền, điều kiện và version; preview không thay dữ liệu, audit hay phiên.

Đã chạy:

- Backend `mvn.cmd -q -DskipTests package`: PASS; build Java 21 trong Docker cũng PASS. Đây là build, không phải bằng chứng unit test.
- Frontend `npm.cmd run build`: PASS.
- `scripts/test-i1.ps1 -PlaywrightModule "$env:TEMP/campus-i1-ui/node_modules/playwright"`: PASS toàn bộ HTTP/PostgreSQL và Edge trên project `campus-events-i1-test`, database tmpfs riêng, API 18080, Angular 14200. Angular test server được dừng sau khi chạy.
- HTTP bổ sung: email/MSSV trùng trả field tương ứng, validation có fields, kết hợp role/status/q và từ chối filter sai; preview trái quyền/Organizer còn sự kiện bị chặn; preview không đổi user/version/audit/phiên; vai trò không đổi không tạo thay đổi; version cũ bị chặn; logout hết phiên/gọi lại xóa cookie, vẫn bắt buộc CSRF.
- UI bổ sung: validation thiếu trường và MSSV/email trùng hiện đúng vị trí; lọc vai trò/trạng thái; cấp Organizer qua xác nhận; xem trước và hủy khóa không ghi; xác nhận khóa/mở/đổi vai trò; logout khi chặn toàn bộ API về đăng nhập ngay, reload không phục hồi user, khôi phục kết nối thu hồi phiên và xóa cookie/cờ, replay cookie cũ trả 401.
- Đã xem ảnh Admin mobile và màn xác nhận. Không tràn ngang toàn trang ở 390 px; bảng tài khoản có vùng cuộn riêng. Ảnh kiểm thử nằm trong `frontend/.angular`, không commit.

Chưa kiểm chứng lần này: dừng database thật để kích hoạt nhánh lỗi 503; việc xác minh người được phân công và bàn giao thông tin đăng nhập ngoài ứng dụng. A7 vẫn cần nhóm chốt người phụ trách/kênh bàn giao. Đây là kiểm thử khi triển khai, chưa thay review/QA độc lập hoặc nghiệm thu client và chưa đánh dấu toàn bộ I1/CP1 hoàn thành.

## Lịch sử kiểm thử ban đầu — 03/11/2026
- Backend build Java 21 trong Docker, frontend build Angular 21 bằng npm ci trên Linux. Lockfile đã được cập nhật tương thích cài sạch.
- scripts/test-i1.ps1: PASS. Dùng PostgreSQL 17 thật, database tmpfs của project campus-events-i1-test, API 18080; không dùng volume local.
- HTTP: bootstrap Admin, seed, đăng ký/canonical email/MSSV, rollback khi trùng MSSV, chống gửi role ADMIN qua đăng ký, mật khẩu/khoa sai, login đúng/sai/khóa, CSRF, quyền STUDENT/ORGANIZER/ADMIN, cookie HttpOnly, me/logout/replay/hết hạn.
- Admin: list/search/pagination, tạo organizer và đổi mật khẩu bắt buộc, phiên cũ bị thu hồi, khóa/mở/đổi vai trò, version cũ, thiếu lý do/vai trò sai/thiếu đơn vị/hồ sơ, organizer còn sự kiện, tự sửa quyền.
- Hai Admin đồng thời khóa nhau: đúng một thay đổi thành công, luôn còn một Admin ACTIVE. Actor được kiểm tra lại trong transaction đã serialize.
- Seed/bootstrap chạy lại sau restart: không tăng số user/event, không ghi đè mật khẩu đã đổi; phiên có trước restart vẫn dùng được.
- Snapshot audit không chứa password_hash/token/password rõ; mật khẩu DB là BCrypt cost 12.
- scripts/smoke/i1_ui.cjs qua Edge headless: PASS. Login sai/đúng, reload, tìm kiếm/rỗng, tạo/khóa/mở/đổi vai trò, đổi mật khẩu tạm, profile organizer, đăng ký/login/profile sinh viên, logout và mobile không tràn ngang.
- Đã xem ảnh admin desktop và màn đăng nhập mobile. Ảnh nằm trong frontend/.angular (không commit).
- Smoke local: frontend -> Nginx -> API -> PostgreSQL PASS, 15 bảng. Múi giờ Asia/Ho_Chi_Minh.

## Tái kiểm tra
```powershell
# Root repository, Docker Desktop đang chạy; Python cần cho HTTP integration tests.
.\scripts\test-i1.ps1
.\scripts\smoke\local.ps1
```

Browser test tùy chọn cần Playwright ở thư mục tạm và Microsoft Edge đã cài:
```powershell
npm.cmd install --prefix "$env:TEMP/campus-i1-ui" --no-audit --no-fund playwright
node .\scripts\smoke\i1_ui.cjs "$env:TEMP/campus-i1-ui/node_modules/playwright"
```
Browser test dùng localhost và dữ liệu seed trong .env; tạo tài khoản giả lập có nhãn UI, không xóa dữ liệu cũ. HTTP integration dùng DB riêng và reset chỉ DB kiểm thử tmpfs mỗi lần chạy.

## Chưa xác minh / còn việc
- Review độc lập theo báo cáo 1.7.2; không tự approve hoặc merge nhánh.
- A05.2 sự kiện thật, full A06/CP1, RA06/demo khách hàng chưa hoàn thành.
- Chưa triển khai cloud/Neon hoặc kiểm thử cross-origin. Local dùng cùng origin; cloud khác host phải có proxy/CORS/cookie được thiết kế và kiểm thử riêng.
- Không khẳng định an toàn/sẵn sàng production chỉ từ các ca trên. Không có email thật hoặc xác minh danh tính trường trong I1.

## Các lỗi đã sửa khi kiểm thử
- JdbcTemplate qua field bean proxy được thay bằng method repository để tránh field không khởi tạo trên proxy.
- Lockfile optional dependency trên Linux đã đồng bộ bằng npm trong container.
- Client lấy CSRF mới trước thao tác ghi, tránh token cũ sau thay đổi trạng thái đăng nhập.
- Select khoa/đơn vị/vai trò có aria-label rõ để thao tác bằng công cụ hỗ trợ.

## Refactor backend — 12/11/2026

Đã chuyển backend sang kiến trúc phân tầng có interface. Unit test, Docker build, HTTP/PostgreSQL regression và local smoke PASS; xem [BACKEND_REFACTOR_RESULTS.md](BACKEND_REFACTOR_RESULTS.md). Không bổ sung nghiệp vụ Increment 2 hoặc thay nghiệm thu I1/CP1.
