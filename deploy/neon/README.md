# Neon PostgreSQL — phương án demo đề xuất

Neon là PostgreSQL được quản lý, không thay backend Java. Luồng đề xuất: Angular/Vercel -> Spring Boot/Render -> Neon. Cấu hình và các bước hiện hành: [DEPLOYMENT_RECOMMENDATION.md](../DEPLOYMENT_RECOMMENDATION.md). Không đưa connection string/password vào Angular.

## Kiểm tra ban đầu
1. Người dùng tạo project/branch/database phát triển trên Neon và chọn vùng gần backend. Chưa có tài nguyên được tạo từ workspace này.
2. Dùng SQL Editor của Neon hoặc pgAdmin/psql kết nối SSL theo thông tin Connect trong console.
3. Để Flyway trong backend tạo/nâng schema khi khởi động. Không chạy baseline SQL thủ công trước. Database I3 cũ cần backup và opt-in nhận baseline theo [OPERATIONS.md](../OPERATIONS.md).
4. Kiểm tra SELECT version(), current_database(); mong đợi 15 bảng nghiệp vụ, flyway_schema_history và event_report trong campus. Nhập đơn vị tổ chức dùng thật riêng, giữ dev-seed tắt. Chưa có bằng chứng schema đã chạy trên Neon.

## Spring Boot
Dùng PostgreSQL JDBC và thông tin SSL được Neon cung cấp. Chỉ backend giữ URL/username/password trong biến môi trường. Ưu tiên direct connection cho giai đoạn đầu với pool ứng dụng nhỏ; pgAdmin và tạo schema dùng direct connection. Khi dùng pooled endpoint phải kiểm tra transaction pooling, không dựa vào session SET search_path/PREPARE hoặc advisory lock cấp session. Advisory lock bảo vệ Admin phải ở cấp transaction. Định danh campus rõ ràng trong truy vấn/mapping. Backend đã có cấu hình DB_URL/DB_USER/DB_PASSWORD qua biến môi trường trong application.properties; chưa có bằng chứng kết nối Neon.

## Chi phí và vận hành
Trang giá kiểm tra 03/11/2026 ghi Free không giới hạn thời gian, không yêu cầu thẻ; vẫn có quota compute/storage. Phải kiểm tra dashboard thực tế trước khi chọn plan. Không tự nâng cấp trả phí. Theo dõi quota, độ trễ khởi động compute và timeout; có pg_dump và thử restore riêng, không mặc định Free bảo đảm mọi nhu cầu backup.

Nguồn: https://neon.com/pricing ; https://neon.com/docs/guides/java ; https://neon.com/docs/connect/connection-pooling
