# Kết quả tự kiểm thử backend I3 — 18/11/2026

Nhánh `feature/i3-backend`, base I2 `43f8c4ca24d025069a38731981f02fd34e11f317`; mã nguồn I3 đã kiểm thử được lưu cùng commit với tài liệu này. Image backend local sau audit: `sha256:7ccbf69c232f475d1ac3da878ea54d4b4c543d0b849d425886c13d63789157f2`.

Phạm vi A09.1/A09.2/A10.1/A10.2 theo Bảng 23/Bảng 33, giữ CSV only và một lượt check-in. Đây là backend và tự kiểm thử; chưa thay frontend, QA/review độc lập, deployment hoặc CP3/CP4.

## Audit bổ sung — bản hiện hành

Đã bổ sung/sửa:

- Tách POST preview chỉ đọc với POST check-in khi sinh viên xác nhận. Preview không ghi attendance/history và trả metadata/eventVersion/registrationVersion/attendanceVersion.
- Chặn xác nhận cũ sau sửa sự kiện, hủy/đăng ký lại hoặc chỉnh điểm danh thủ công bằng 409 CONFIRMATION_STALE. Khi đã PRESENT vẫn giữ idempotency, không ghi đè actor/method hoặc thêm audit.
- Guard tại database kiểm tra cả cửa sổ event hiện hành và phiên tại đúng lúc ghi. Nếu hết hạn/qua ends_at sau khi service đã kiểm tra, trả 409 QR_SESSION_INVALID thay vì 503; không ghi attendance/history một phần.
- Có migration thay hàm guard cho DB đang có dữ liệu, không thêm/xóa bảng. Chạy hai lần trên DB test giữ nguyên số lượng users/events/registrations/attendance; SQL regression reset đăng ký vẫn PASS. Đã áp dụng cho DB local hiện có.
- Có `scripts/demo-i3.ps1` cho từng bước Start/Preview/Confirm/Report/Export, thủ công có lý do/History, Close/Refresh với thời hạn 1–30 phút và Stop. Demo ở cổng 18083, tách cả DB/secret với app 4200/8080 và autotest 18082. Hướng dẫn: [I3_MANUAL.md](I3_MANUAL.md).

Kiểm chứng bản audit:

| Kiểm tra | Kết quả |
| --- | --- |
| Maven test trên host và Docker build | PASS 43 test, 0 failure/error |
| I3 HTTP/PostgreSQL | PASS toàn bộ ca cũ và preview không ghi, stale event/admission/manual result, expiry/end xảy ra trong lúc ghi và rollback |
| Regression I1 HTTP/PostgreSQL | PASS |
| Regression I2 HTTP/PostgreSQL + mail giả lập | PASS sau sửa test timing; không gửi thư thật |
| Migration chạy lặp + SQL reset đăng ký | PASS, dữ liệu giữ nguyên |
| Demo từng bước | PASS: Report 0 trước Confirm, 1 sau Confirm; Confirm lặp giữ 1; ManualClear/Preview/Confirm/History/Export, Close/Refresh 1 phút và Stop/Start tạo fixture mới |
| Smoke localhost qua frontend proxy và backend | PASS, 15 bảng campus; không reset volume phát triển |

Hai ca deadline được tạo trong DB test: thay expiry sau kiểm tra service nhưng trước trigger, và trì hoãn INSERT qua ends_at trong khi session còn hạn. Cả hai nhận QR_SESSION_INVALID, attendance không được ghi. Migration dùng mã SQLSTATE riêng, các lỗi database khác tiếp tục trả 503 như trước.

Đợt regression phát hiện test email I2 phụ thuộc trạng thái FAILED chỉ tồn tại vài giây: worker đã chuyển SENT/2 attempts trước lần SELECT kế tiếp nên assertion sai. Chỉ sửa test transport/harness: lưu lịch sử mã HTTP và kiểm tra [503,201], [500,400], tối đa năm 503, cùng trạng thái cuối. Không sửa logic email runtime. Retest PASS.

Smoke đầu khi dựng nhiều stack đồng thời từng vượt 60 giây chờ vì backend khởi động lạnh khoảng một phút; khi readiness đạt, API trực tiếp và qua proxy đều PASS. Hướng dẫn cập nhật dùng Compose --wait; không thay logic Nginx để né lỗi startup.

Bộ dữ liệu local 2.000 đăng ký trong bản audit: report khoảng 0,066 giây, CSV 0,909 giây; 10.001 dòng bị chặn 413. Đây là phép đo local đơn lẻ, không phải load test/benchmark cloud.

Log audit tại backend/target: i3-audit-unit.log, i3-audit-integration.log, i3-audit-i1.log, i3-audit-i2.log, i3-audit-demo.log và i3-audit-local.log. Bí mật demo nằm trong target bị Git ignore; log không in mật khẩu/khóa. Giao diện camera/confirmation và frontend I2/I3 vẫn chưa tích hợp.

## Kết quả triển khai I3 ban đầu (trước audit)

| Lệnh / kiểm tra | Kết quả |
| --- | --- |
| `mvn -f backend/pom.xml test` | PASS 39 unit test, 0 failure/error |
| `./scripts/test-i3.ps1` | PASS HTTP/Spring Boot/PostgreSQL 17 thật, DB tmpfs riêng |
| `./scripts/test-i2.ps1` | PASS regression I2, HTTP mail giả lập, không gửi email thật |
| `./scripts/test-i1.ps1` | PASS HTTP/PostgreSQL I1; không chạy lại browser trong đợt I3 vì chưa sửa frontend |
| `./scripts/setup-local.ps1` chạy lại | PASS giữ nguyên toàn bộ cấu hình/key đã có, không in secret |
| `docker compose up --build -d` và `./scripts/smoke/local.ps1` | PASS backend healthy, frontend 200, DB connected, schema campus 15 bảng |

Maven Docker build cũng chạy unit test, không skip. 39 test gồm 29 test I1/I2, QrTokenCipher 2, AttendanceRules 3, ReportCsvWriter 2, AttendanceService 3. QR test dựng raster từ chính SVG backend rồi giải mã bằng ZXing, xác nhận nhận đúng type/event/session/token.

Log local bị Git ignore tại backend/target: i3-unit.log, i3-integration.log, i3-i1-regression.log, i3-i2-regression.log, i3-local-build.log và surefire-reports. Các kịch bản được giữ trong source để tái chạy.

## Các ca tích hợp đạt

- Vai trò/ownership/CSRF: anonymous 401, Student/Admin không mở/chỉnh/xem báo cáo, Organizer khác 404, thiếu CSRF 403. Payload studentId giả bị bỏ qua, recordedBy luôn là Student trong phiên xác thực.
- Mốc thời gian: quá sớm 409, unit test đúng biên starts_at−30 phút/ends_at; session hết hạn hoặc đóng bị từ chối; thời hạn QR cắt tại ends_at. Không cho mở/quét sau kết thúc.
- Phiên và token: QR SVG thật, no-store, không lộ token thô trong SVG text/hash/ciphertext response; mở lặp trả cùng phiên, đóng lặp không đổi dữ liệu, mở lại đổi id/token; expiry tự đóng dòng cũ trước khi tạo mới. Restart backend vẫn giải mã lại đúng token bằng khóa ổn định.
- Check-in: chỉ REGISTERED, chặn WAITLISTED/chưa đăng ký, token sai/malformed bị từ chối; quét lặp idempotent. Hai scan đồng thời chỉ một chuyển trạng thái và một audit.
- Thủ công: yêu cầu lý do và hai version; không nhận ABSENT; version cũ 409; hai chỉnh sửa cùng version chỉ một thành công. History có actor, lý do, before/after và before=null khi tạo mới.
- Đăng ký lại I2/I3: giữ registration.id, reset NOT_RECORDED/SYSTEM có audit, phiên bản đăng ký cũ không được cập nhật kết quả lượt mới; quét lại mới tạo PRESENT hiện hành.
- Atomicity: trigger fault trên attendance_history trong DB test làm rollback attendance; retry sau bỏ trigger chỉ có một kết quả/history.
- Báo cáo: REGISTERED=3, PRESENT=1 cho tỷ lệ 33,3%; chưa kết thúc absent=null. Hủy người có PRESENT giữ bằng chứng nhưng loại khỏi numerator/denominator. Sau ends_at suy ra ABSENT; bổ sung thủ công sau sự kiện làm báo cáo đổi thành 100%/0 vắng. Không ghi ABSENT vào database, denominator=0 trả null rate.
- CSV: UTF-8 BOM, tiếng Việt, dấu phẩy/ngoặc kép/xuống dòng, chống công thức kể cả có khoảng trắng; headers attachment/no-store, trạng thái đúng, số liệu khớp summary. Mặc định REGISTERED, status= lấy tất cả; CANCELLED có attendanceState=NOT_APPLICABLE. Không người vẫn xuất được summary với tỷ lệ rỗng.
- Bộ dữ liệu local 2.000 đăng ký: report khoảng **0,030 giây**, CSV khoảng **0,091 giây** trong lần chạy được ghi log. Đúng 2.000 dòng chi tiết. 10.001 dòng trả 413, không cắt âm thầm. Đây là phép đo một request local trên DB test, không phải load test đồng thời hoặc chứng cứ cloud.

## Lỗi đã phát hiện và retest

- `status=` bị Spring áp default REGISTERED: đổi tham số optional và chỉ áp default khi không có tham số. Retest danh sách/CSV lấy tất cả, phân trang và lọc mặc định PASS.
- Helper SQL Windows dùng encoding/translation mặc định làm lỗi tiếng Việt hoặc đổi LF trong giá trị thành CRLF: truyền bytes UTF-8 tường minh vào psql và decode stdout UTF-8. Retest tên đa dòng, công thức và CSV PASS.
- QR decoder test ban đầu đọc raster một pixel/module: dựng raster theo kích thước hiển thị (5 pixel/module); giải mã SVG thực PASS. Không thay encoder để né lỗi kiểm thử.

## Trạng thái local và giới hạn

Ứng dụng tại http://localhost:4200, API http://localhost:8080. DB vẫn là volume local hiện có; không xóa/đổi schema. ATTENDANCE_TOKEN_KEY đã được sinh cục bộ và truyền vào backend; MAIL_ENABLED=false, không gửi thêm thư thật. Dừng các stack test độc lập sau khi kiểm tra; stack local tiếp tục chạy.

Còn frontend I2/I3, camera/QR scan UI, dashboard báo cáo và luồng demo đầu cuối. Sinh viên sẽ quét QR của Organizer; chưa có luồng Organizer quét QR từng sinh viên. Chưa có chống điểm danh hộ tuyệt đối, offline synchronization, checkout, Excel hoặc PDF export.

Giới hạn export 10.000 dòng; dữ liệu lớn hơn cần lọc hoặc triển khai streaming/job. Khóa QR phải dùng chung/ổn định giữa instance/restart. Người có quyền được chỉnh sau ends_at với audit, nên số liệu cuối vẫn có thể thay đổi khi có sửa hợp lệ. Chưa deploy Render/Neon/Lightsail, thử restore hoặc đóng A11/A12/CP3/CP4.
