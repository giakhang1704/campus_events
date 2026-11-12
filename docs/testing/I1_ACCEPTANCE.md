# A02.1 — Tiêu chí và test case I1

Các ca A05.1 dưới đây được chạy bằng scripts/test-i1.ps1 trên database riêng, không thay QA review độc lập. Kết quả cụ thể ghi I1_RESULTS.md sau khi chạy; tài liệu này là expected, không tự coi mọi ca đã PASS.

| ID | Ca kiểm tra | Kết quả mong đợi |
|---|---|---|
| AUTH-01 | Đăng ký hợp lệ | 201 STUDENT; users/profile cùng tồn tại |
| AUTH-02 | Email khác hoa/thường hoặc MSSV trùng | 409; không tạo user mồ côi |
| AUTH-03 | Payload đăng ký gửi role=ADMIN | Tài khoản vẫn STUDENT |
| AUTH-04 | Mật khẩu ngắn/UTF-8 quá dài, khoa sai, thiếu trường | 400 |
| AUTH-05 | Đăng nhập đúng/sai/tài khoản khóa | 200 hoặc 401; không trả hash/token |
| AUTH-06 | Reload/me và logout/replay phiên | Phiên hợp lệ được phục hồi; replay sau logout 401 |
| AUTH-07 | Thiếu CSRF với POST/PATCH | 403, không thay đổi dữ liệu |
| AUTH-08 | Sinh viên/organizer gọi API Admin trực tiếp | 403 |
| AUTH-09 | Phiên hết hạn/thu hồi/auth_version cũ | 401 |
| ADM-01 | Admin tìm/lấy danh sách/phân trang | DTO an toàn, không bỏ sót/trùng dòng giữa trang |
| ADM-02 | Cấp organizer | 201, mật khẩu hash, buộc đổi lần đầu |
| ADM-03 | Đổi mật khẩu sai/đúng | 400 hoặc 204; thu hồi phiên; login lại được |
| ADM-04 | Khóa/mở tài khoản | Phiên cũ mất hiệu lực; mở lại không phục hồi phiên cũ |
| ADM-05 | Vai trò cố định | Đường dẫn đổi vai trò/preview cũ trả 403 kể cả Admin; user/version/audit/phiên không đổi |
| ADM-06 | Tự khóa | 409 |
| ADM-07 | Hai Admin đồng thời khóa nhau | Không mất Admin ACTIVE cuối; ít nhất một yêu cầu bị chặn |
| ADM-08 | Version cũ hoặc thiếu lý do khi khóa/mở | 409 hoặc 400 |
| ADM-09 | Khóa Organizer còn sự kiện nháp/chưa kết thúc | 409 |
| ADM-10 | Gửi role=ADMIN qua tạo Organizer hoặc khóa/mở | Vai trò tạo luôn ORGANIZER; cập nhật trạng thái không đổi vai trò |
| DATA-01 | Bootstrap/seed chạy lại | Không nhân bản, không ghi đè mật khẩu/dữ liệu |
| DATA-02 | Audit trước/sau | Có actor/reason/version; không hash/token/password |

Phần Organizer A05.2 đã có kiểm thử trong `scripts/smoke/i1_events.py` và `i1_events_ui.cjs`; API Sinh viên đã có kiểm thử trong `scripts/smoke/i1_event_reads.py`; FE Sinh viên vẫn cần triển khai. Checklist toàn A05.2: tạo/sửa/công bố/tìm/xem; không lộ nháp; không sửa sự kiện người khác; version conflict; sức chứa dương; thời gian hợp lệ; chọn nhiều khoa/năm; dữ liệu giữ sau reload.

UI checklist: đăng ký, đăng nhập, logout, tài khoản, Admin list/search/pagination/create/lock/unlock; không có nút đổi vai trò, đổi mật khẩu bắt buộc; loading/error/empty và validation. Kiểm thử API không thay kiểm tra trình duyệt/layout.

## Đối chiếu UC-01–03 và UC-21–23 (UC-24 đã bỏ)

| ID | Ca bổ sung | Kết quả mong đợi |
|---|---|---|
| UC01-VALIDATION | Gửi form thiếu trường, mật khẩu vượt 72 byte UTF-8 hoặc MSSV/email trùng | Hiển thị lỗi tại trường; trường hợp trùng có hướng dẫn đăng nhập; không lưu một phần |
| UC02-ERROR | Đăng nhập sai/khóa; dịch vụ dữ liệu gián đoạn | Không tạo phiên; sai/khóa có hướng dẫn liên hệ Admin, lỗi dữ liệu trả 503 có thông báo thử lại và không lộ SQL |
| UC03-EXPIRED | Logout khi phiên hết hạn hoặc gọi logout lại | 204 với CSRF hợp lệ; cookie phiên được xóa; thiếu CSRF vẫn 403 |
| UC03-OFFLINE | Chặn mạng API rồi logout, reload; khôi phục kết nối | Về đăng nhập ngay và báo chưa xác nhận thu hồi; reload không khôi phục user; online thu hồi phiên và xóa cookie/cờ; replay phiên cũ 401 |
| UC21-FILTER | Kết hợp từ khóa, vai trò và trạng thái, cả phân trang | Điều kiện AND; không lẫn vai trò/trạng thái; giá trị lọc sai trả 400 |
| UC22-CONFIRM | Xem thông tin cấp Organizer rồi hủy/xác nhận | Hủy không tạo; xác nhận mới gửi tạo; không hiển thị mật khẩu trên trang xác nhận; nhắc bàn giao riêng và đổi lần đầu |
| UC23-PREVIEW | Xem trước khóa/mở rồi hủy | Trả tài khoản, trước/sau, lý do, tác động; không đổi version/audit/phiên; hủy không gửi PATCH |
| FIXED-ROLE | Kiểm tra UI và gọi trực tiếp API đổi vai trò cũ | Không có thao tác đổi vai trò; request bị chặn và vai trò/phiên giữ nguyên |
| ADMIN-RECHECK | Sau preview có cập nhật khác, sau đó xác nhận với version cũ | PATCH kiểm tra lại và trả 409; không ghi đè; quyền/quy tắc vẫn kiểm tra khi lưu |

Chạy HTTP + UI trên database riêng (Node và dependencies frontend đã cài, Microsoft Edge và Playwright module có sẵn):

```powershell
.\scripts\test-i1.ps1 -PlaywrightModule "$env:TEMP/campus-i1-ui/node_modules/playwright"
```

Lệnh mở Angular tại 127.0.0.1:14200, proxy đến backend test 18080, dừng Angular khi kết thúc. Không dùng stack/database local. Xác minh người được phân công và kênh bàn giao theo A7 vẫn cần nhóm chốt, thực hiện và ghi nhận ngoài ứng dụng.

CP1 còn cần A05.2, A06 đầy đủ, RA06, build/evidence và review/demo độc lập. Chưa đánh dấu CP1 hoàn thành chỉ vì A05.1 chạy được.

## Organizer UC-12–14

| Ca | Kết quả mong đợi |
|---|---|
| Tạo/sửa nháp, reload | Dữ liệu PostgreSQL và giới hạn khoa/năm được giữ; status DRAFT |
| Gửi thiếu trường/không offset, số thập phân, thời gian sai, khoa/năm không hợp lệ | 400, không lưu một phần |
| Gửi organizerId/status giả | Chủ sở hữu lấy từ phiên; tạo vẫn DRAFT; cập nhật không đổi chủ/trạng thái |
| Student/Admin, mật khẩu tạm hoặc thiếu CSRF gọi API ghi | 403 |
| Organizer khác gọi GET/PATCH/publish trực tiếp | 404, không lộ hoặc sửa sự kiện ngoài phạm vi |
| Hai tab cùng version lưu | Một thành công, một 409; UI giữ nội dung chưa lưu, tải bản mới bằng thao tác rõ ràng |
| Xác nhận/hủy công bố | Hủy không đổi dữ liệu; xác nhận chuyển PUBLISHED và có publishedAt; không tạo đăng ký |
| Gọi lại publish/current version | Không tăng version hoặc đổi publishedAt; version cũ 409 |
| Unit test | Quy tắc thời gian/version/eligibility và service ownership/auth/publication được kiểm chứng |

Build Docker backend chạy unit test (`mvn package`, không bỏ qua test). Unit test có thể chạy bằng `cd backend; mvn test`. Test API sự kiện chạy trong test-i1.ps1; browser chạy thêm với tham số PlaywrightModule như trên. API sự kiện không thay thế FE Sinh viên hoặc kiểm thử QA độc lập.

## API tìm/xem sự kiện UC-04–05

| Ca | Kết quả mong đợi |
|---|---|
| Chưa đăng nhập/phiên không hợp lệ | 401 JSON; tài khoản phải đổi mật khẩu trả 403 |
| Student/Organizer/Admin xem danh sách | Chỉ PUBLISHED; không tạo quyền chỉnh sửa |
| Từ khóa hoa/thường, tiếng Việt và khoảng trắng | Tìm chứa theo title, Unicode/case-insensitive; trim q |
| Từ khóa chứa %, _, ! hoặc chuỗi SQL | Tìm literal, không mở rộng LIKE hay chèn SQL |
| Phân trang, sự kiện trùng starts_at | ORDER BY starts_at/id, không trùng/bỏ dòng trong dữ liệu tĩnh, hasNext đúng |
| Không tìm thấy/vượt trang | 200 với items rỗng, hasNext=false |
| Truy cập nháp/ID không tồn tại | Cùng 404 EVENT_NOT_FOUND cho mọi vai trò, kể cả chủ nháp |
| Xem chi tiết | Đủ nội dung, lịch, đơn vị, sức chứa, mảng khoa/năm; [] nghĩa không giới hạn |
| Query quá dài, page/size sai giới hạn/kiểu, id không dương hoặc sai kiểu | 400 JSON, không lộ SQL/stacktrace |
| GET và đọc lại sau chỉnh sửa | GET không ghi/đổi version/đăng ký; lần đọc sau lấy dữ liệu PostgreSQL mới |

Unit test EventReadServiceTest và HTTP i1_event_reads.py nằm trong bộ test-i1.ps1. Đây là kiểm thử backend; chưa có FE Sinh viên dùng API mới.
