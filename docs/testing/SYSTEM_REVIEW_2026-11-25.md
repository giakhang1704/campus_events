# Rà soát BKevent — 25/11/2026

Phạm vi: lịch sử nhánh đã fetch từ GitHub, source Angular/Spring Boot/PostgreSQL, cấu hình local/deploy và phạm vi MVP trong `report/section/task1/1.2.tex`, kế hoạch I1–I3 của nhóm. Đây là tự rà soát kỹ thuật; không thay QA/review độc lập hoặc nghiệm thu CP3/CP4.

## Kết luận

Code chức năng I1–I3, kết quả điểm danh trên chi tiết và sửa mô tả dài đã được commit/push ở `test/system-validation` (`bd77472`, kế thừa `26efcbb`). Đợt sửa lỗi/hạ tầng tiếp theo đang nằm trên cùng nhánh ở working tree. `main` vẫn ở I1; chưa có môi trường cloud hoặc nghiệm thu CP3/CP4. Theo xác nhận của người dùng, đợt này giữ MVP, chưa bổ sung xác minh email/SSO/quên mật khẩu.

## Nhánh và commit

| Nhánh remote | Commit đầu nhánh | Nội dung |
| --- | --- | --- |
| `main` | `4cc5d6f` | I1 đã merge; chưa nhận I2/I3 |
| `feature/i2-backend` | `83474e4` | Backend I2 và frontend I2 qua PR #3 |
| `feature/i3-backend` | `1b99579` | Backend QR, thủ công, báo cáo/CSV; không phải bản frontend I3 đầy đủ |
| `feature/i3-frontend` | `98f6024` | Kế thừa backend I3 + frontend I2; có Organizer điểm danh và Báo cáo/CSV |
| `feature/i3-scan-frontend` | `26efcbb` | Kế thừa nhánh trên, thêm camera/decoder QR và sửa trạng thái phiên Organizer |
| `test/system-validation` | `bd77472` + các thay đổi working tree đợt này | Chi tiết điểm danh, sửa tràn chữ, rà soát và bộ sửa lỗi/hạ tầng dưới đây |
| `feature/i1-frontend-subtasks` | `5d61365` | Một bản thiết kế lại UI Admin chưa được gộp vào các nhánh mới; không nên merge toàn nhánh cũ chỉ để lấy giao diện |

Các nhánh I1 và refactor cũ đã nằm trong lịch sử nhánh I3 mới. Không cần merge lại từng nhánh tổ tiên. Chốt candidate trên nhánh I3 mới nhất, review qua PR rồi mới đưa vào `main`; giữ các commit chưa được review tách khỏi release.

## Chức năng

| Nhóm | Đã có |
| --- | --- |
| Tài khoản | Sinh viên đăng ký, BCrypt, đăng nhập/đăng xuất, đổi mật khẩu, phiên HttpOnly và CSRF |
| Phân quyền | Student/Organizer/Admin, quyền sở hữu sự kiện, khóa/mở, bảo vệ Admin cuối cùng |
| Sự kiện | Nháp/sửa/công bố, version chống ghi đè, tìm/xem, nhiều khoa/năm, sức chứa nguyên dương |
| Đăng ký | Đăng ký/hủy trước bắt đầu, sức chứa, waitlist FIFO, tăng sức chứa đôn chờ, kiểm tra đồng thời |
| Đăng ký lại | Cùng dòng hiện hành, tăng version, reset điểm danh và lưu lịch sử |
| Email | Brevo HTTP + outbox; xác nhận, đôn chờ, thay đổi quan trọng |
| Điểm danh | QR do Organizer phát, Student quét → preview → xác nhận; thời hạn phiên; thủ công có lý do/lịch sử |
| Báo cáo | Tổng quan, chi tiết phân trang, vắng sau ends_at, tỷ lệ REGISTERED, CSV có BOM/escape/chống công thức |
| Chi tiết sinh viên | Trạng thái điểm danh, thời gian/phương thức, tải lại, liên kết QR đúng cửa sổ; hủy/đăng ký lại bỏ dữ liệu hiển thị cũ |
| Nội dung dài | Chuỗi 2.500 chữ `a` xuống dòng trong khung; giữ nội dung và xuống dòng do người nhập |

CSV-only, một lượt điểm danh, chưa dùng loại sự kiện, không đồng bộ offline đầy đủ và không chống điểm danh hộ tuyệt đối là các giới hạn đã chốt. Email nhắc trước sự kiện không thuộc MVP trong bản phạm vi báo cáo hiện hành; không tính là thiếu chức năng bắt buộc.

## Kết quả xử lý trong đợt này

| Vấn đề | Thay đổi và kiểm chứng |
| --- | --- |
| QR hiện PRESENT cũ khi đăng ký đã hủy | Cả `showExisting` và fallback QR hết hạn đều yêu cầu REGISTERED + attendanceState=PRESENT + bản ghi PRESENT. Kiểm thử UI có preview còn PRESENT nhưng lần đọc hiện hành đã CANCELLED; không hiện thành công. Chặn phản hồi muộn ghi đè lượt quét mới và camera ghi đè bước preview. |
| Sự kiện công bố bị 100 nháp che; scan thiếu trang đăng ký | Tải tiếp theo hasNext, chống dữ liệu trùng/vòng lặp không tiến triển, bỏ phản hồi đã hết hiệu lực. UI đã pass trường hợp 100 nháp ở trang đầu, sự kiện công bố ở trang 2; trang đăng ký đầu toàn sự kiện kết thúc, trang 2 có sự kiện sắp tới. |
| Login/register chưa hạn chế thử liên tục | Thêm rate limit IP/email trong backend, cửa sổ thời gian, bộ nhớ hữu hạn, an toàn đồng thời; 429/Retry-After. Không khóa tài khoản. Unit test và HTTP thật đã pass. Bộ đếm theo process; nhiều replica cần giải pháp chia sẻ. |
| Chưa có migration history | Thêm Flyway V1/V2, validate checksum, khóa clean. Schema I3 cũ cần backup và opt-in; preflight kiểm layout trước baseline. PostgreSQL 17 thật đã pass tạo mới, restart, nhận schema cũ giữ dữ liệu/id, từ chối thiếu cột và checksum sửa sai. Health chỉ đếm 15 bảng nghiệp vụ. |
| Danh mục production | Sửa nhận xét cũ: 12 khoa đã được CatalogInitializer đồng bộ độc lập trước đợt này. Thêm `seed-catalog.py`/`production_catalog.sql` nhập đơn vị riêng, validation/transaction/chống trùng, không tạo tài khoản demo. Sửa lỗi mã hóa argv của psql trên Windows; test tên tiếng Việt có dấu nháy, nhập lặp và tên rỗng đã pass. Tên đơn vị dùng thật vẫn cần nhóm nhập. |
| Chưa có công cụ backup/restore | Thêm `scripts/database-backup.py`: archive binary, SHA-256, chống ghi đè, restore chỉ vào database mới có prefix riêng. Diễn tập PostgreSQL 17 đã pass: giữ số liệu users/events/registrations/attendance/history/outbox/migration, sequence tiếp tục chạy, khởi động app phục hồi, đăng nhập và CSV. Không đánh dấu đã thử Neon. |
| Polling giữ Neon hoạt động | Outbox rỗng giãn chu kỳ tới 10 phút; mail mới đánh thức sau commit; có việc thì giữ nhịp retry nhanh. Thêm `/api/live` chờ app ready nhưng không query database cho Render probe. Unit test pass; quota/scale-to-zero cần đo trên cloud. |
| Deploy mới có hướng dẫn | Thêm `render.yaml` Free/manual deploy và `frontend/vercel.mjs` đọc BACKEND_ORIGIN, proxy API, SPA fallback, no-store. Render schema và quy tắc route local đã kiểm tra. Chưa tạo dịch vụ hoặc nghiệm thu HTTPS. |
| Chưa có CI | Thêm `.github/workflows/validation.yml`: unit/PostgreSQL 17, frontend build/UI contracts, HTTP I1/I2/I3 và backup/restore Docker. Workflow đã qua schema validation; cần push và xem run thật trên GitHub. |

Cấu hình và các lệnh có thể chạy lại: [OPERATIONS.md](../../deploy/OPERATIONS.md), [đề xuất triển khai](../../deploy/DEPLOYMENT_RECOMMENDATION.md).

## Còn cần làm trước nghiệm thu/deploy thật

- Review độc lập, commit bộ sửa lỗi này, PR và regression trước khi đưa candidate vào `main`. Không tự đánh dấu đã merge/review.
- Nhập đơn vị tổ chức đã được nhóm chốt; tạo Admin bằng bootstrap và tắt bootstrap/dev-seed sau đó.
- Tạo Neon/Render/Vercel, đặt secret backend và BACKEND_ORIGIN. Thử cookie/CSRF/logout, camera điện thoại thật qua HTTPS, CSV và restart bằng khóa QR ổn định.
- Diễn tập backup/restore trên database/branch cloud riêng và lưu bằng chứng; test local không thay nghiệm thu môi trường triển khai.
- Chạy CI trên GitHub và hoàn thiện biên bản demo/phản hồi CP3/CP4. RA02/A11 Lightsail chưa được thực hiện; hosting khác phải ghi nhận thay đổi trong báo cáo.
- Backlog ngoài MVP: xác minh email/SSO, quên mật khẩu, delivered/bounce, dọn phiên/outbox và giám sát tập trung. MSSV/email tự khai hiện chưa xác minh danh tính sinh viên.

## Kiểm tra đã chạy

- Backend hiện tại: **55 test PASS**, gồm 50 unit test và 5 test migration/HTTP trên PostgreSQL 17.6 thật; không skip/failure/error. Lệnh `mvn -Ppostgres-it test` trong backend.
- `NativeSystemCheck` PASS: chạy toàn bộ HTTP I3 trên PostgreSQL riêng, restart backend cùng khóa QR, phân quyền/CSRF, concurrent writes, reset khi đăng ký lại, rollback audit, guard đúng thời hạn, báo cáo/CSV. Sau đó nhập danh mục tiếng Việt/dấu nháy, backup/restore vào DB mới và kiểm tra app phục hồi đăng nhập/CSV, sequence, chống ghi đè. Dữ liệu fixture: 10.011 users, 11 events, 10.008 registrations, 6 attendance. Không gửi email thật.
- Fixture 2.000 dòng: report <5 giây, CSV <10 giây; 10.001 dòng export bị chặn 413 như hợp đồng. Đây là kiểm tra local, không phải benchmark cloud.
- Build production frontend PASS.
- `mvn -f backend/pom.xml package` từ root PASS: 50 unit test và đóng gói executable JAR thành công. Bộ PostgreSQL native chỉ chạy khi bật profile/runner riêng; build Docker thông thường không cần khởi động PostgreSQL để chạy unit test.
- **15 nhóm UI contract PASS**: 11 nhóm chi tiết đã có và 4 nhóm regression QR/phân trang mới. Toàn bộ API được chặn và trả fixture; không coi là bằng chứng backend/database hoặc camera phần cứng.
- Đã xem ảnh desktop/mobile. Thêm kiểm tra chi tiết sau scan vào `scripts/smoke/i3_scan_ui.cjs` để chạy với backend thật khi môi trường sẵn sàng.
- Dependency audit hiện tại: frontend production 0 cảnh báo; toàn bộ frontend còn 16 moderate ở toolchain, không có high/critical. Bộ Playwright riêng có 0 cảnh báo. Đây là kết quả npm, không thay quét dependency Java hoặc kiểm thử bảo mật ứng dụng.
- Docker Desktop chưa sẵn sàng trong lượt này. Các kết quả PostgreSQL hiện tại dùng server native tạm, tự dừng sau test; không sửa/xóa volume dữ liệu phát triển. Chưa chạy lại I1/I2 đầy đủ trong Docker, browser full-stack hoặc workflow trên GitHub; CI đã được cấu hình để chạy các bộ HTTP đó khi push.

Lệnh kiểm tra UI độc lập Docker, từ root:

```powershell
npm.cmd ci --prefix frontend
npm.cmd ci --prefix scripts/smoke
./scripts/test-i3-student-attendance.ps1
```

Khi Docker hoạt động, chạy tiếp `./scripts/test-i3-ui.ps1`, `./scripts/test-i3-reports.ps1`, các bộ backend I1/I2/I3 phù hợp, rồi thử điện thoại thật trên HTTPS. Camera giả lập kiểm chứng decoder/luồng UI, không thay kiểm tra camera phần cứng.
