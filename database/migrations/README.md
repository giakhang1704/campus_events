# Nâng cấp database đang có dữ liệu

Từ đợt 25/11/2026, backend dùng Flyway tự quản lý version/checksum trong `backend/src/main/resources/db/migration/`. Các file ở thư mục này giữ làm tài liệu SQL đối chiếu trước đây; không dùng thay Flyway trong release mới. Database mới không chạy baseline SQL thủ công trước.

`001_i3_qr_write_guard.sql` thay thế hàm guard_attendance trong transaction, không thêm/xóa bảng hoặc dữ liệu. QR được kiểm tra lại tại thời điểm ghi theo event PUBLISHED, starts_at−30 phút, ends_at hiện hành và thời hạn phiên. SQLSTATE PQR01 được backend chuyển thành 409 QR_SESSION_INVALID. Script chạy lại được.

Database I3 cũ cần backup, nhận baseline một lần với `DB_BASELINE_EXISTING=true`, sau đó Flyway chạy V2 và giữ dữ liệu. Xem [OPERATIONS.md](../../deploy/OPERATIONS.md). Không reset volume.

Lệnh dưới đây dành riêng cho checkout cũ chưa có Flyway:

```powershell
./scripts/migrate-local.ps1
docker compose up --build -d backend
```

Trong release dùng Flyway, không sửa V1/V2 đã được áp dụng; tạo migration V3 trở đi khi schema thay đổi. Không chạy lại baseline lên dữ liệu hiện có, không dùng down -v để nâng cấp.
