# PostgreSQL

schema/01_schema.sql là baseline làm việc, chỉ chạy lần đầu trên database rỗng. Compose tự nạp nó khi named volume được tạo mới. Không chạy cả bản nguồn trong references.
queries/02_queries.sql là PREPARE mẫu, cần cùng phiên khi EXECUTE; không phải API.
tests/01_inspect.sql kiểm tra cấu trúc; tests/02_registration_reset.sql kiểm thử bằng fixtures ROLLBACK. migrations và seeds chưa có dữ liệu nghiệp vụ được duyệt.

Một dòng đăng ký/student/event, reset attendance có audit bằng method SYSTEM trong trigger đăng ký lại. Service không ghi trùng REREGISTER tự sinh. View event_report dùng has_ended (qua ends_at), không coi báo cáo bất biến khi attendance còn được sửa. Backend vẫn chịu trách nhiệm phân quyền, sức chứa, FIFO, deadline đăng ký và outbox.

Đã chạy schema/regression trên PGlite và PostgreSQL server 17.11 Docker. Backend kết nối thành công; chưa chạy Neon hoặc test concurrency đầy đủ. Múi giờ Asia/Ho_Chi_Minh. Xem docs/environment/SMOKE_TEST.md, LOCAL_RUN.md và docs/design/CANCELLATION.md.
