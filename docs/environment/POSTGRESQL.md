# PostgreSQL và pgAdmin trên Windows

PostgreSQL là database server. pgAdmin 4 là ứng dụng GUI kết nối server để tạo DB, chạy SQL, xem bảng. psql là công cụ dòng lệnh. MySQL Workbench dành cho MySQL; không dùng để chạy DDL PostgreSQL của dự án này.

Ngày 03/11/2026 chỉ thấy thư mục data của PostgreSQL 18 trên máy đã kiểm tra, không thấy bin/psql.exe và không thấy service có tên chứa postgres qua kiểm tra. Đây có thể là thư mục sót; chưa đủ bằng chứng PostgreSQL server/pgAdmin hoạt động. Không truy cập hoặc khởi tạo lại data có sẵn.

## Chuẩn bị
Nếu máy chưa có server chạy được, dùng bộ cài Windows từ https://www.postgresql.org/download/windows/ và chọn PostgreSQL server, pgAdmin và command line tools. Nhóm cần thống nhất major version dùng local/server; schema nguồn ghi 15+, chưa kiểm thử phiên bản cụ thể. Không chọn lại thư mục data cũ nếu chưa xác định dữ liệu trong đó.

## Chạy trong pgAdmin
1. Mở pgAdmin, kết nối server local. Nếu cần Register Server: host localhost, port theo cấu hình cài đặt (thường 5432), user đã tạo khi cài; nhập mật khẩu thực trên máy. Master password của pgAdmin khác mật khẩu database.
2. Tạo database mới tên campus_events_dev bằng menu Databases > Create > Database. Tên này là đề xuất local, không phải database đã được tạo.
3. Chọn đúng database mới, mở Query Tool, mở database/schema/01_schema.sql và chạy toàn bộ. Script có BEGIN/COMMIT, chỉ chạy một lần trên database rỗng. Không chạy trên database nhóm đang có dữ liệu.
4. Refresh Schemas > campus > Tables. Chạy database/tests/01_inspect.sql; mong đợi 15 bảng, view event_report và capacity NOT NULL integer. Schema nằm trong campus, không phải public.
5. Truy vấn SELECT * FROM campus.events; trả 0 dòng là bình thường khi chưa seed, không chứng minh backend đã kết nối.
6. Sau khi có seed: kiểm tra vai trò, đăng ký/chờ/hủy, QR, tăng sức chứa và báo cáo. Kiểm thử hai phiên song song cho chỗ cuối và Admin cuối cần workflow backend hoàn chỉnh.

## PowerShell (sau khi công cụ đã cài)
Từ thư mục campus-events, nếu psql đã có trong PATH:

```powershell
psql -h localhost -U postgres -d campus_events_dev -W -v ON_ERROR_STOP=1 -f .\database\schema\01_schema.sql
psql -h localhost -U postgres -d campus_events_dev -W -v ON_ERROR_STOP=1 -f .\database\tests\01_inspect.sql
```

postgres chỉ là user quản trị minh họa lúc tạo local, không phải tài khoản chạy backend production. -W hỏi mật khẩu tương tác; không đặt mật khẩu trong lệnh hoặc Git. Nếu psql không trong PATH, gọi đường dẫn psql.exe thực tế bằng toán tử & của PowerShell.

## Kết nối Spring Boot về sau
Ví dụ JDBC URL công khai: jdbc:postgresql://localhost:5432/campus_events_dev?currentSchema=campus. Username/password đưa qua cấu hình backend/biến môi trường đã mô tả; frontend không nhận chúng. Chưa tạo application.properties vì chưa khởi tạo Spring Boot và chọn cơ chế cấu hình.

## Nguồn chính thức
- https://www.postgresql.org/download/windows/
- https://www.pgadmin.org/docs/pgadmin4/latest/query_tool.html
