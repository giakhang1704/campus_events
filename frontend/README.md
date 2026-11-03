# Angular 21 — tài khoản I1

Node 24; npm ci; npm start. Mở http://localhost:4200. Backend 8080, proxy /api trong proxy.conf.json. npm run build xuất dist/campus-events/browser. Docker Compose chạy stack ở README gốc.

core/api.ts: fetch cùng origin + CSRF, trạng thái user; không lưu token vào localStorage/sessionStorage. features/auth: đăng ký/đăng nhập; features/admin: danh sách/tìm/phân trang/cấp/khóa/đổi vai trò. main.ts phục hồi phiên khi tải lại, logout và đổi mật khẩu bắt buộc.

Nút Xem mockup giữ public/mockup để tham khảo phần chưa tích hợp. Tài khoản thật nằm ngoài khung; đăng nhập trong khung là dữ liệu mô phỏng riêng. Nguồn mockup cũ giữ nguyên trong docs/references.
