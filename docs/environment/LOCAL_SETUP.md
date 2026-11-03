# Môi trường local hiện hành

Đọc LOCAL_RUN.md cho lệnh chạy thực tế và SMOKE_TEST.md cho kết quả kiểm chứng. Các hướng dẫn chỉ tạo thư mục trước 03/11 đã được thay thế.

Host đã kiểm tra: Java 24.0.2, Maven 3.9.11, Node 24.11.1, npm 11.6.2, Git 2.47.0. Dự án build target Java 21; Docker dùng JDK/JRE 21, PostgreSQL 17. Frontend Angular 21.0.0. Đã chạy PostgreSQL 17.11 trong Docker, khắc phục socket Docker và kiểm tra đủ stack; xem SMOKE_TEST.md.

Đã có schema/ERD và mockup làm việc. Chưa có API nghiệp vụ được duyệt, tài khoản Neon/Brevo hoặc cloud deployment. Không tự coi cấu hình đầy đủ là bằng chứng A03 hoàn tất.
