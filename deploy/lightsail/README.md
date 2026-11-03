# Lightsail — phương án theo báo cáo, chưa triển khai

nginx/: reverse proxy, TLS, static Angular và SPA fallback.
systemd/: quản lý Spring Boot JAR và restart/log.
postgresql/: hướng dẫn bind local, quyền DB, backup/restore.

Các thư mục hiện là vị trí chuẩn bị, chưa có config được xác minh vì chưa có app build/domain/OS/instance. Nếu chọn demo ở Vercel + backend riêng, giữ phương án này để chuyển sau; không tự coi RA02/A11 Lightsail đã đạt.

Chi phí tham khảo kiểm tra 03/11/2026: gói Linux public IPv4 2GB/2vCPU/60GB là 12 USD/tháng; snapshot 0.05 USD/GB-tháng. Chưa gồm mọi khoản phát sinh/thuế. Chưa thuê instance.
Nguồn: https://aws.amazon.com/lightsail/pricing/
