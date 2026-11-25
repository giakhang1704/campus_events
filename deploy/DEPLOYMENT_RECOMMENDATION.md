# Đề xuất deploy BKevent — 25/11/2026

Đề xuất cho demo nhóm: **Angular trên Vercel, Spring Boot Docker trên Render, PostgreSQL trên Neon, email qua Brevo HTTP**. Giữ backend phân tầng hiện tại; chưa cần tách microservices hoặc đổi sang JWT để deploy. Đây là hướng triển khai, chưa phải bằng chứng đã deploy.

Hệ thống vẫn theo ba tầng frontend/API/database; bên trong backend là layered monolith (Controller → Service → Repository). Việc đặt các tầng trên các dịch vụ khác nhau không biến backend thành microservices.

```mermaid
flowchart LR
    U[Trình duyệt / điện thoại HTTPS] --> V[Vercel: Angular]
    V -->|/api proxy| R[Render: Spring Boot]
    R --> N[Neon: PostgreSQL]
    R --> B[Brevo HTTP API]
```

## Vì sao dùng proxy `/api`

Frontend hiện gọi `/api` với `credentials: same-origin`; cookie phiên HttpOnly có Path=/api, SameSite=Lax và CSRF cookie/token đi kèm. Cho trình duyệt gọi thẳng `onrender.com` từ `vercel.app` sẽ cần thiết kế lại cross-origin/cookie. External rewrite giữ URL ở domain frontend, phù hợp cơ chế đang có. Cần xác minh Set-Cookie, logout, CSRF và CSV qua proxy trên bản preview. [Vercel: external rewrites](https://vercel.com/docs/routing/rewrites).

Không chuyển token sang localStorage để xử lý lỗi deploy. Cookie bảo mật được bật ở backend; mọi API vẫn kiểm tra quyền như local.

## Các bước

1. Chốt nhánh chứa I1/I2/I3, phần chi tiết điểm danh và sửa nội dung dài. Hoàn thành review/regression trước khi đưa candidate lên cloud.
2. Tạo project Neon PostgreSQL, chọn vùng gần backend. Database rỗng: chạy `database/schema/01_schema.sql` một lần bằng Neon SQL Editor hoặc psql. Database đã có campus: dùng migration tương ứng, không chạy lại baseline. Nhập danh mục khoa/đơn vị dùng thật riêng với tài khoản demo.
3. Tạo Render Web Service, source repo này, Docker runtime, **Root Directory `backend`**, Dockerfile `Dockerfile`, health check `/api/health`. App đã đọc PORT qua application.properties. Đặt SERVER_ADDRESS=0.0.0.0 để Render truy cập được. [Render: web services/port](https://render.com/docs/web-services#port-binding).
4. Đặt secrets/environment dưới đây ở backend. Tạo Admin đầu tiên bằng bootstrap; sau khi kiểm tra đăng nhập, tắt bootstrap và gỡ mật khẩu bootstrap khỏi cấu hình. Giữ dev-seed tắt.
5. Tạo Vercel project: Root Directory `frontend`, install `npm ci`, build `npm run build`, output `dist/campus-events/browser`. Thêm external rewrite `/api/:path*` trước SPA fallback. Chạy deploy preview để kiểm tra đường dẫn trực tiếp.
6. Test qua HTTPS: Admin cấp Organizer → đổi mật khẩu → tạo/công bố → Student đăng ký → mail → quét QR/xác nhận → trang chi tiết → thủ công/lịch sử → báo cáo/CSV → logout và thử request trái quyền. Sau đó kiểm tra restart backend vẫn đọc phiên/QR bằng khóa ổn định, backup/restore và log lỗi.

## Environment backend

Giá trị dưới đây là tên/placeholder; không dùng mật khẩu thật trong Git:

```dotenv
SERVER_ADDRESS=0.0.0.0
TZ=Asia/Ho_Chi_Minh
DB_URL=jdbc:postgresql://<neon-direct-host>/<database>?sslmode=require&currentSchema=campus
DB_USER=<database-role>
DB_PASSWORD=<backend-secret>
AUTH_COOKIE_SECURE=true
ATTENDANCE_TOKEN_KEY=<base64-of-32-random-bytes>
CAMPUS_DEV_SEED_ENABLED=false
CAMPUS_BOOTSTRAP_ENABLED=true
CAMPUS_BOOTSTRAP_EMAIL=<first-admin-email>
CAMPUS_BOOTSTRAP_PASSWORD=<initial-admin-secret>
MAIL_ENABLED=false
BREVO_API_KEY=<backend-secret>
BREVO_SENDER_EMAIL=<verified-sender>
BREVO_SENDER_NAME=BKevent
```

Ban đầu MAIL_ENABLED=false để kiểm tra tài khoản/dữ liệu; xác minh sender và dữ liệu người nhận rồi mới bật. Bootstrap chỉ tạo Admin khi chưa có Admin hoạt động, không cấp lại mật khẩu cho tài khoản có sẵn. Khóa QR phải giữ ổn định qua restart/deploy. JDBC URL dùng thông số Neon Connect và SSL; ứng dụng hiện giữ user/password ở hai biến riêng. Khởi đầu dùng direct endpoint với Hikari pool nhỏ (hiện tối đa 5) để giảm các khác biệt về transaction/session pooling. [Neon: Java/JDBC](https://neon.com/docs/guides/java).

## Rewrite Vercel cần có

Đây là ví dụ để tạo `frontend/vercel.json` sau khi biết hostname Render; **thay hostname trước khi dùng**:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://YOUR-BACKEND.onrender.com/api/:path*" },
    { "source": "/((?!api(?:/|$)|assets(?:/|$)|.*\\.).*)", "destination": "/index.html" }
  ]
}
```

Kiểm tra API không bị trả index.html, assets không bị rewrite nhầm, deep link `/events/6`/`/scan`/`/reports` mở được và logout xóa cookie trên đúng frontend domain. Không cache riêng các response phiên/QR/báo cáo của người dùng. Đừng copy nguyên Nginx local sang cloud: upstream `backend:8080` chỉ tồn tại trong mạng Docker Compose.

Quy tắc regex trong rewrites dùng capture group theo [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json). App này là CSR nên fallback dùng index.html; nếu sau này bật prerender/SSR phải đối chiếu lại output theo [Angular deployment](https://angular.dev/tools/cli/deployment).

## Chi phí và giới hạn

| Dịch vụ | Phương án demo và giới hạn cần biết |
| --- | --- |
| Vercel | Hobby miễn phí trong quota; quyền cộng tác/usage phụ thuộc gói. [Hobby](https://vercel.com/docs/plans/hobby) |
| Render | Có Free Web Service, ngủ sau 15 phút không có traffic; lần truy cập sau phải đợi khởi động. Không phù hợp yêu cầu luôn sẵn sàng. [Free instances](https://render.com/docs/free) |
| Neon | Free hiện có 100 CU-hours/project/tháng và 1 GB Postgres/project; compute tự nghỉ sau 5 phút. Theo dõi quota, không mặc định miễn phí vô hạn tài nguyên. [Neon plans](https://neon.com/docs/introduction/plans) |
| Brevo | Giữ HTTP API đã tích hợp. Render Free chặn các cổng SMTP thông dụng, nên không chuyển sang SMTP Gmail chỉ để deploy. [Render SMTP restriction](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports) |

Có thể bắt đầu với free tier trong giới hạn của từng dịch vụ. Nếu dùng thật hoặc demo cần phản hồi ổn định, ưu tiên backend Render trả phí không ngủ; chọn plan theo dashboard/bảng giá tại lúc triển khai. Không dùng Render Postgres Free thay Neon cho dữ liệu cần giữ lâu chỉ vì cùng nhà cung cấp: tài liệu Render hiện ghi database Free hết hạn sau 30 ngày.

Từ việc Render Free ngủ có thể suy ra scheduler gửi outbox trong process cũng dừng lúc ngủ; retry còn lưu trong PostgreSQL và tiếp tục khi backend chạy lại. Không cam kết mail nền hoặc thời gian phản hồi luôn tức thì trên phương án miễn phí.

Cũng cần tính quota database theo polling: khi MAIL_ENABLED=true, `EmailDispatcher` mặc định hỏi outbox mỗi 5 giây, kể cả chưa có mail chờ. Từ code này có thể suy ra một backend chạy liên tục sẽ giữ Neon có hoạt động và giảm khả năng scale-to-zero. Ví dụ compute 0,25 CU chạy 24 giờ × 30 ngày dùng khoảng 180 CU-hours, vượt mức Free 100 CU-hours. Đây là phép tính minh họa, không phải mức dùng đã đo của project; điều chỉnh chu kỳ/lịch xử lý theo nhu cầu và theo dõi dashboard trước khi chọn kế hoạch chạy thường trực.

Chưa tạo tài khoản/project, chưa đẩy secrets lên dịch vụ, chưa phát sinh chi phí. Nếu dùng phương án này thay Lightsail, ghi rõ thay đổi trong báo cáo; không đánh dấu RA02/A11 Lightsail đã hoàn thành.
