# So sánh nơi triển khai — 03/11/2026

- Local: Angular + Spring Boot + PostgreSQL trên máy; không trả hosting nhưng không phải app online công khai.
- Demo online: cân nhắc Vercel Hobby cho FE, dịch vụ Java riêng cho BE, PostgreSQL riêng. Có thể dùng free tier nhưng không hứa toàn hệ thống miễn phí hoặc luôn sẵn sàng.
- Lightsail: phương án trong báo cáo; Linux public IPv4 2GB hiện 12 USD/tháng, snapshot có phí riêng. Ứng dụng và DB cùng máy giúp đơn giản nhưng không HA.

Render free web service ngủ sau 15 phút không có request và khởi động lại khoảng một phút. Render free PostgreSQL hết hạn sau 30 ngày và không có backup quản lý. Nếu tạo ngày 03/11 thì khoảng 03/12 đã tới hạn, trước hạn nộp 06/12; không dùng mặc định cho toàn đợt bàn giao. Outbox email không thể hứa xử lý liên tục trên backend ngủ.

Vercel Hobby dành cho personal/non-commercial, giới hạn usage; cần đối chiếu quyền deploy/repository khi có GitHub nhóm. Vercel không thay thế server Java và PostgreSQL.

Kiến trúc đã chọn không đổi theo hosting: SPA + modular monolith API + PostgreSQL. Chưa chốt nhà cung cấp cloud mới, chưa tạo tài nguyên. Thay hosting nghiệm thu cần ghi nhận thay đổi so với Lightsail trong baseline, không tự sửa lịch/chi phí báo cáo.

Nguồn: https://vercel.com/docs/plans/hobby ; https://vercel.com/docs/functions/runtimes ; https://render.com/docs/free ; https://aws.amazon.com/lightsail/pricing/


## Neon — cập nhật phương án demo
Đề xuất Neon cho PostgreSQL cloud; xem deploy/neon/README.md. Vẫn cần host riêng cho Spring Boot; chưa chốt provider backend, chưa tạo Neon project, chưa kiểm tra schema trên Neon. Kiến trúc modular monolith không thay đổi. Các đoạn trước ghi chưa chọn DB cloud là trạng thái trước đề xuất này.
