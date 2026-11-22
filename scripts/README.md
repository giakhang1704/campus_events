# Script hỗ trợ

Chỉ bổ sung script khi đã có lệnh chạy/build thực tế. Ưu tiên hướng dẫn PowerShell cho local Windows; script triển khai Linux phụ thuộc môi trường được cấp.

`./scripts/test-i3-reports.ps1`: kiểm thử màn Báo cáo + CSV trên Edge headless với API/PostgreSQL thật thuộc stack tạm riêng. Cài dependency bằng `npm.cmd ci --prefix frontend` và `npm.cmd ci --prefix scripts/smoke` từ root. Runner dùng cổng 18084/14204, không dùng `.env`, tắt email, tự tạo dữ liệu và tự dừng server test. Chi tiết: [I3_REPORTS_UI.md](../docs/testing/I3_REPORTS_UI.md).
