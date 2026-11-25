# Angular trên Vercel

Chỉ frontend. Chọn Root Directory `frontend`, Node 24. `frontend/vercel.mjs` đã có install/build/output, proxy `/api` và SPA fallback. Đặt `BACKEND_ORIGIN=https://<backend>.onrender.com` trên Vercel cho từng môi trường. Không tạo thêm vercel.json. Xem [hướng dẫn triển khai](../DEPLOYMENT_RECOMMENDATION.md).

API URL là cấu hình công khai; không đặt DB password/email secret ở frontend. Backend và database cần dịch vụ riêng. Kiểm tra quota/điều kiện gói và quyền deploy của nhóm trong dashboard trước khi tạo tài nguyên. [Hobby](https://vercel.com/docs/plans/hobby), [programmatic config](https://vercel.com/docs/project-configuration/vercel-ts).
Chưa tạo project hoặc deploy.
