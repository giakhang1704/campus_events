# Script hỗ trợ

Chỉ bổ sung script khi đã có lệnh chạy/build thực tế. Ưu tiên hướng dẫn PowerShell cho local Windows; script triển khai Linux phụ thuộc môi trường được cấp.

`./scripts/test-i3-reports.ps1`: kiểm thử màn Báo cáo + CSV trên Edge headless với API/PostgreSQL thật thuộc stack tạm riêng. Cài dependency bằng `npm.cmd ci --prefix frontend` và `npm.cmd ci --prefix scripts/smoke` từ root. Runner dùng cổng 18084/14204, không dùng `.env`, tắt email, tự tạo dữ liệu và tự dừng server test. Chi tiết: [I3_REPORTS_UI.md](../docs/testing/I3_REPORTS_UI.md).

`./scripts/test-i3-ui.ps1`: kiểm thử màn `/attendance` (Organizer) và `/scan` (Student) trên Edge headless với stack tạm riêng, cổng 18085/14205. Camera được thay bằng luồng canvas hiển thị mã QR thật nên bộ đọc, xem trước, xác nhận và các lỗi (mạng, mã đã đóng, danh sách chờ, chưa đăng ký, chặn camera) đều chạy qua API thật. Cần PowerShell 7 (`pwsh`) giống các runner khác.
