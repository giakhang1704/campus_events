# Rà soát BKevent — 25/11/2026

Phạm vi: lịch sử nhánh đã fetch từ GitHub, source Angular/Spring Boot/PostgreSQL, cấu hình local/deploy và phạm vi MVP trong `report/section/task1/1.2.tex`, kế hoạch I1–I3 của nhóm. Đây là tự rà soát kỹ thuật; không thay QA/review độc lập hoặc nghiệm thu CP3/CP4.

## Kết luận

Code chức năng chính I1–I3 đã tập trung ở `feature/i3-scan-frontend` (`26efcbb`, kế thừa `98f6024` Báo cáo/CSV). Local đã thêm kết quả điểm danh trên chi tiết sự kiện và sửa mô tả dài không có dấu cách. Chưa thể gọi là sẵn sàng vận hành: `main` còn ở I1, chưa có triển khai cloud/khôi phục được kiểm chứng và còn các điểm bên dưới.

## Nhánh và commit

| Nhánh remote | Commit đầu nhánh | Nội dung |
| --- | --- | --- |
| `main` | `4cc5d6f` | I1 đã merge; chưa nhận I2/I3 |
| `feature/i2-backend` | `83474e4` | Backend I2 và frontend I2 qua PR #3 |
| `feature/i3-backend` | `1b99579` | Backend QR, thủ công, báo cáo/CSV; không phải bản frontend I3 đầy đủ |
| `feature/i3-frontend` | `98f6024` | Kế thừa backend I3 + frontend I2; có Organizer điểm danh và Báo cáo/CSV |
| `feature/i3-scan-frontend` | `26efcbb` | Kế thừa nhánh trên, thêm camera/decoder QR và sửa trạng thái phiên Organizer |
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
| Chi tiết sinh viên | Local: trạng thái điểm danh, thời gian/phương thức, tải lại, liên kết QR đúng cửa sổ; hủy/đăng ký lại bỏ dữ liệu hiển thị cũ |
| Nội dung dài | Local: chuỗi 2.500 chữ `a` xuống dòng trong khung; giữ nội dung và xuống dòng do người nhập |

CSV-only, một lượt điểm danh, chưa dùng loại sự kiện, không đồng bộ offline đầy đủ và không chống điểm danh hộ tuyệt đối là các giới hạn đã chốt. Email nhắc trước sự kiện không thuộc MVP trong bản phạm vi báo cáo hiện hành; không tính là thiếu chức năng bắt buộc.

## Những điểm còn cần xử lý

| Ưu tiên | Phát hiện và bằng chứng | Hướng xử lý |
| --- | --- | --- |
| Trước release | Candidate I3 chưa nằm trong `main`; phần bổ sung hôm nay còn local | Review/commit phần mới, PR nhánh tích hợp, chạy regression trước merge |
| Trước public deploy | `deploy/` chủ yếu là hướng dẫn; chưa có cấu hình Vercel proxy/SPA, Render service và một môi trường cloud đã thử | Tạo cấu hình theo [đề xuất deploy](../../deploy/DEPLOYMENT_RECOMMENDATION.md), xác minh auth/CSRF/camera/CSV trên HTTPS |
| Trước public deploy | `SeedRunner` tạo danh mục thử cùng tài khoản thử khi bật dev-seed. Tắt dev-seed trên database rỗng thì thiếu khoa/đơn vị để đăng ký/cấp Organizer | Tách seed danh mục dùng thật khỏi seed tài khoản demo; nhập danh mục đã được nhóm chốt |
| Trước public deploy | Migration đang chạy SQL thủ công; `spring.sql.init.mode=never`, chưa có version tracking tự động | Có bước migration được kiểm soát khi release; cân nhắc Flyway. Baseline chỉ chạy một lần trên DB rỗng |
| Trước dùng thật | Chưa có thử backup → restore của môi trường triển khai | Xuất backup, phục hồi vào database/branch riêng, kiểm tra tài khoản/sự kiện/đăng ký/điểm danh/CSV, lưu log |
| Cần sửa/kiểm thử thêm | `/scan`, hàm `showExisting()` đang kiểm tra `attendance.result === PRESENT` mà chưa kiểm tra `registrationStatus`/`attendanceState`. Nếu hủy sau preview và trước lần đọc kết quả, bằng chứng cũ có thể được hiện như kết quả hiện hành | Thêm guard REGISTERED + attendanceState=PRESENT, kiểm thử trường hợp hủy giữa hai request. Đây là phát hiện từ đọc code; chưa tái hiện bằng HTTP/PostgreSQL trong lượt này |
| Cần cải thiện | `OwnedEventPicker` chỉ đọc 100 sự kiện đầu rồi bỏ DRAFT. Nhiều nháp mới có thể che sự kiện công bố cũ; danh sách tham khảo trên trang scan cũng chỉ đọc trang đăng ký đầu | Thêm tìm kiếm/phân trang hoặc tải tiếp; không coi danh sách đầu là toàn bộ dữ liệu |
| Trước mở đăng ký rộng | Repo chưa có rate limit cho login/register; chưa xác minh email/MSSV thực sự thuộc sinh viên | Giới hạn tần suất backend, theo dõi đăng nhập; bổ sung xác minh email/SSO theo mức sử dụng. Không dùng việc tự khai MSSV như xác nhận danh tính |
| Khi vận hành | Chưa có quên mật khẩu, theo dõi mail delivered/bounce, chính sách dọn phiên/outbox và giám sát lỗi tập trung | Ưu tiên theo nhu cầu; reset mật khẩu phải có luồng xác minh, không gửi mật khẩu thô qua email |
| Khi chọn free tier | Email outbox polling mỗi 5 giây khi mail được bật có thể giữ Neon hoạt động nếu backend chạy thường trực | Tính quota theo lịch polling thực tế; không giả định database tự ngủ chỉ vì không có người mở web |
| Trước chốt CP3/CP4 | `.github` mới có PR template, chưa có CI chạy build/test; chưa có thử điện thoại thật qua HTTPS và biên bản nghiệm thu | Bổ sung CI, test thiết bị thật và bằng chứng demo/review độc lập |

## Kiểm tra đã chạy

- Nhánh `26efcbb`: 43 unit test backend PASS, không skip/failure/error.
- Build production của nhánh mới và phần bổ sung chi tiết PASS.
- 11 nhóm kiểm tra UI với API giả lập theo hợp đồng PASS: Có mặt QR/thủ công, giờ Việt Nam trên thiết bị UTC, tải lại, hủy/đăng ký lại, phản hồi muộn, lỗi/thử lại, chưa đăng ký/chờ, giới hạn thời gian, tự tải lại khi ends_at, Organizer preview, mobile và chuỗi dài không dấu cách.
- Đã xem ảnh desktop/mobile. Thêm kiểm tra chi tiết sau scan vào `scripts/smoke/i3_scan_ui.cjs` để chạy với backend thật khi môi trường sẵn sàng.
- Dependency audit hiện tại: frontend production 0 cảnh báo; toàn bộ frontend còn 16 moderate ở toolchain, không có high/critical. Bộ Playwright riêng có 0 cảnh báo. Đây là kết quả npm, không thay quét dependency Java hoặc kiểm thử bảo mật ứng dụng.
- Chưa chạy lại bộ HTTP/PostgreSQL và camera end-to-end trong lượt này: Docker Desktop kẹt `starting`, API engine lỗi và restart timeout. Không xem API giả lập là bằng chứng backend/database đã pass. Không sửa/xóa volume dữ liệu phát triển.

Lệnh kiểm tra UI độc lập Docker, từ root:

```powershell
npm.cmd ci --prefix frontend
npm.cmd ci --prefix scripts/smoke
./scripts/test-i3-student-attendance.ps1
```

Khi Docker hoạt động, chạy tiếp `./scripts/test-i3-ui.ps1`, `./scripts/test-i3-reports.ps1`, các bộ backend I1/I2/I3 phù hợp, rồi thử điện thoại thật trên HTTPS. Camera giả lập kiểm chứng decoder/luồng UI, không thay kiểm tra camera phần cứng.
