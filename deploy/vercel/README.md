# Angular trên Vercel — phương án đang xem xét

Chỉ frontend. Chọn root frontend/ khi ứng dụng đã được khởi tạo. Build command và output directory lấy từ angular.json/CLI thực tế, chưa đoán tên dist. Cần SPA fallback cho route trực tiếp; thêm vercel.json sau khi xác nhận output và API routing để không rewrite API nhầm sang index.html.

API URL là cấu hình công khai; không đặt DB password/email secret ở frontend. Backend và database cần dịch vụ riêng. Vercel Hobby miễn phí có giới hạn và chỉ dành cho personal/non-commercial; phải kiểm tra điều kiện repository/quyền deploy của nhóm.
Nguồn: https://vercel.com/docs/plans/hobby và https://vercel.com/docs/functions/runtimes
Chưa tạo project hoặc deploy.
