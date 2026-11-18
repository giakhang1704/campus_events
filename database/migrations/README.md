# Nâng cấp database đang có dữ liệu

`01_schema.sql` là baseline chỉ dành cho database rỗng. Các file ở đây là nâng cấp cho schema đang sử dụng; chưa có migration framework tự chạy khi backend khởi động.

`001_i3_qr_write_guard.sql` thay thế hàm guard_attendance trong transaction, không thêm/xóa bảng hoặc dữ liệu. QR được kiểm tra lại tại thời điểm ghi theo event PUBLISHED, starts_at−30 phút, ends_at hiện hành và thời hạn phiên. SQLSTATE PQR01 được backend chuyển thành 409 QR_SESSION_INVALID. Script chạy lại được.

Local, từ root repository, khi DB container đang chạy:

```powershell
./scripts/migrate-local.ps1
docker compose up --build -d backend
```

Database mới đã chứa cùng hàm trong baseline; chạy lại migration vẫn an toàn. Neon/PostgreSQL khác: dùng tài khoản có quyền cập nhật hàm trong campus để chạy nội dung file qua SQL Editor/psql, rồi cập nhật backend. Không chạy lại baseline lên dữ liệu hiện có, không dùng down -v để nâng cấp.
