# Frontend — Angular 21

Node 24; `npm ci`; `npm start` → http://localhost:4200. Backend 8080, proxy `/api` trong proxy.conf.json. `npm run build` xuất dist/campus-events/browser. Docker Compose chạy stack ở README gốc.

## Cấu trúc `src/app`
```text
core/api.ts              fetch cùng origin + CSRF, trạng thái user (Api.user); không lưu token vào localStorage/sessionStorage
core/auth/session.ts     khôi phục phiên (/auth/me) một lần, guard đăng nhập/vai trò/đổi mật khẩu, trang chủ theo vai trò
core/layout/             shell (sidebar + topbar) và menu theo vai trò (navigation.ts — giữ đồng bộ với app.routes.ts)
core/catalog.service.ts  cache danh mục khoa/đơn vị cho màn chỉ đọc
features/auth            /login (đăng nhập + đăng ký sinh viên), /change-password (đổi mật khẩu lần đầu)
features/admin           /admin/accounts: danh sách/tìm/phân trang/cấp/khóa/mở; mỗi tài khoản một vai trò cố định
features/events          /manage (organizer: nháp, sửa, công bố), /events + /events/:id (sinh viên xem sự kiện đã công bố)
features/system          /system: kiểm tra /api/health + mockup tham khảo
shared/                  icon, page-header, coming-soon
```

## Trạng thái I1
- Đã nối API thật: đăng nhập/đăng ký/đăng xuất/đổi mật khẩu, quản lý tài khoản, sự kiện của người tổ chức, xem sự kiện đã công bố.
- Nút "Đăng ký tham gia" ở chi tiết sự kiện đang tắt (`TODO(API)`) vì backend I1 chưa có API đăng ký.
- Các route `my-events`, `scan`, `participants`, `attendance`, `reports` hiện trang "Đang xây dựng"; `data.mockupFn` ghi hàm nguồn trong `public/mockup/app.js`.
- Giao diện dùng CSS của mockup (`src/styles.css`, phần đầu) + lớp Angular ở cuối file. Phần ngoài phạm vi (category, check-out, kết thúc thủ công) để trong comment `DEFERRED` theo docs/decisions/SCOPE.md.

## Thêm một màn hình
1. Tạo `features/<module>/<ten>.page.ts` (standalone, signals, `ChangeDetectionStrategy.OnPush`).
2. Thêm route trong `app.routes.ts` (thay `comingSoon` nếu có) và mục menu trong `core/layout/navigation.ts`.
3. Gọi API qua `Api.request` (hoặc service trong feature). Guard chỉ ẩn giao diện; backend vẫn kiểm tra quyền.

## Kiểm thử giao diện
`node scripts/smoke/i1_ui.cjs <đường dẫn module playwright>` với stack đang chạy và tài khoản seed (scripts/seed-local.ps1). Script dùng Edge (`channel: msedge`).

## Phiên bản dependency — rà soát 12/11/2026

Framework/compiler Angular 21.2.26, CLI/build 21.2.29, TypeScript 5.9.3, RxJS 7.8.2; Node 24. Lockfile được tạo mới trên Linux rồi cài sạch bằng npm ci, không dùng --force/--legacy-peer-deps. Sau khi pull đổi lockfile, chạy npm.cmd ci.

`npm audit --omit=dev` hiện 0 cảnh báo; audit đầy đủ còn 16 moderate ở toolchain CLI (glob/minimatch), không còn high/critical. Đây là kiểm tra dependency npm tại thời điểm rà soát, không phải kết luận toàn hệ thống không còn lỗ hổng. Chi tiết: [REPOSITORY_REVIEW.md](../docs/testing/REPOSITORY_REVIEW.md).
