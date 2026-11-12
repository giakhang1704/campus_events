# Angular trên Vercel — phương án đang xem xét

Chỉ frontend. Ứng dụng Angular đã có: chọn root frontend/, cài bằng npm ci, build bằng npm run build, output dist/campus-events/browser theo angular.json và build đã kiểm tra. Cần SPA fallback cho route trực tiếp; thêm vercel.json sau khi xác nhận output và API routing để không rewrite API nhầm sang index.html.

API URL là cấu hình công khai; không đặt DB password/email secret ở frontend. Backend và database cần dịch vụ riêng. Vercel Hobby miễn phí có giới hạn và chỉ dành cho personal/non-commercial; phải kiểm tra điều kiện repository/quyền deploy của nhóm.
Nguồn: https://vercel.com/docs/plans/hobby và https://vercel.com/docs/functions/runtimes
Chưa tạo project hoặc deploy.
