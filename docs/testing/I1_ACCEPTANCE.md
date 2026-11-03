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
| ADM-05 | Đổi vai trò | API dùng quyền mới ngay, hồ sơ sinh viên được giữ |
| ADM-06 | Tự khóa/tự đổi quyền | 409 |
| ADM-07 | Hai Admin đồng thời khóa nhau | Không mất Admin ACTIVE cuối; ít nhất một yêu cầu bị chặn |
| ADM-08 | Version cũ, thiếu lý do, vai trò không hợp lệ | 409 hoặc 400 |
| ADM-09 | Organizer còn sự kiện nháp/chưa kết thúc bị thu hồi | 409 |
| ADM-10 | Chuyển STUDENT thiếu hồ sơ/ORGANIZER thiếu đơn vị | 409/400 |
| DATA-01 | Bootstrap/seed chạy lại | Không nhân bản, không ghi đè mật khẩu/dữ liệu |
| DATA-02 | Audit trước/sau | Có actor/reason/version; không hash/token/password |

A05.2 cần chạy sau khi triển khai: tạo/sửa/công bố/tìm/xem; không lộ nháp; không sửa sự kiện người khác; version conflict; sức chứa dương; thời gian hợp lệ; chọn nhiều khoa/năm; dữ liệu giữ sau reload.

UI checklist: đăng ký, đăng nhập, logout, tài khoản, Admin list/search/pagination/create/lock/role, đổi mật khẩu bắt buộc; loading/error/empty và validation. Kiểm thử API không thay kiểm tra trình duyệt/layout.

CP1 còn cần A05.2, A06 đầy đủ, RA06, build/evidence và review/demo độc lập. Chưa đánh dấu CP1 hoàn thành chỉ vì A05.1 chạy được.
