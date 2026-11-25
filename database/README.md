# PostgreSQL

Backend tự quản lý schema bằng Flyway trong `backend/src/main/resources/db/migration/`: V1 tạo mới, V2 cập nhật guard QR. Compose không mount init SQL nữa. `schema/01_schema.sql` giữ làm bản SQL tham khảo/test độc lập; không chạy nó trước Flyway hoặc chạy lại trên DB hiện hữu. Không chạy cả bản nguồn trong references.
queries/02_queries.sql là PREPARE mẫu, cần cùng phiên khi EXECUTE; không phải API.
tests/01_inspect.sql kiểm tra cấu trúc; tests/02_registration_reset.sql kiểm thử bằng fixtures ROLLBACK. `migrations/` giữ SQL đối chiếu trước Flyway. Nâng schema I3 cũ cần backup và `DB_BASELINE_EXISTING=true` một lần; xem [vận hành](../deploy/OPERATIONS.md). Không sửa migration đã release. `seeds/README.md` hướng dẫn dữ liệu local, opt-in và không ghi đè tài khoản cũ.

Một dòng đăng ký/student/event, reset attendance có audit bằng method SYSTEM trong trigger đăng ký lại. Service không ghi trùng REREGISTER tự sinh. View event_report dùng has_ended (qua ends_at), không coi báo cáo bất biến khi attendance còn được sửa. Backend vẫn chịu trách nhiệm phân quyền, sức chứa, FIFO, deadline đăng ký và outbox.

Đã chạy schema/regression trên PGlite và PostgreSQL 17 Docker; backend I2 đã kiểm tra đăng ký đồng thời và FIFO trên DB test riêng. Backend local kết nối thành công; chưa chạy Neon hoặc load test quy mô lớn. Múi giờ Asia/Ho_Chi_Minh. Hướng dẫn chạy ở [README gốc](../README.md); quy tắc hủy/đăng ký lại ở [backend README](../backend/README.md#i2-api).

Danh mục 12 khoa/chương trình được backend đồng bộ bằng `CatalogInitializer` khi khởi động, độc lập với tài khoản demo. Không thêm bảng hoặc thay schema; upsert theo code giữ id. API chỉ liệt kê danh mục hiện hành theo thứ tự đã chốt; dữ liệu mẫu cũ vẫn được giữ để không mất liên kết lịch sử.
