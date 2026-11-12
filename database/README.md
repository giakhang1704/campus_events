# PostgreSQL

schema/01_schema.sql là baseline làm việc, chỉ chạy lần đầu trên database rỗng. Compose tự nạp nó khi named volume được tạo mới. Không chạy cả bản nguồn trong references.
queries/02_queries.sql là PREPARE mẫu, cần cùng phiên khi EXECUTE; không phải API.
tests/01_inspect.sql kiểm tra cấu trúc; tests/02_registration_reset.sql kiểm thử bằng fixtures ROLLBACK. migrations hiện chưa có công cụ nâng cấp schema tự động; seeds/README.md hướng dẫn seed dữ liệu local qua backend, opt-in và không ghi đè dữ liệu cũ.

Một dòng đăng ký/student/event, reset attendance có audit bằng method SYSTEM trong trigger đăng ký lại. Service không ghi trùng REREGISTER tự sinh. View event_report dùng has_ended (qua ends_at), không coi báo cáo bất biến khi attendance còn được sửa. Backend vẫn chịu trách nhiệm phân quyền, sức chứa, FIFO, deadline đăng ký và outbox.

Đã chạy schema/regression trên PGlite và PostgreSQL 17 Docker; backend I2 đã kiểm tra đăng ký đồng thời và FIFO trên DB test riêng. Backend local kết nối thành công; chưa chạy Neon hoặc load test quy mô lớn. Múi giờ Asia/Ho_Chi_Minh. Hướng dẫn chạy ở [README gốc](../README.md); quy tắc hủy/đăng ký lại ở [backend README](../backend/README.md#i2-api).

Danh mục 12 khoa/chương trình được backend đồng bộ bằng `CatalogInitializer` khi khởi động, độc lập với tài khoản demo. Không thêm bảng hoặc thay schema; upsert theo code giữ id. API chỉ liệt kê danh mục hiện hành theo thứ tự đã chốt; dữ liệu mẫu cũ vẫn được giữ để không mất liên kết lịch sử.
