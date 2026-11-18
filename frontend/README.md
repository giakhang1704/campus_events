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
features/registrations   I2: khung đăng ký trên /events/:id, /my-events (sinh viên), /participants (organizer)
features/system          /system: kiểm tra /api/health + mockup tham khảo
shared/                  icon, page-header, coming-soon
```

## Trạng thái I1 + I2
- Đã nối API thật: đăng nhập/đăng ký/đăng xuất/đổi mật khẩu, quản lý tài khoản, sự kiện của người tổ chức, xem sự kiện đã công bố.
- I2 (docs/api/I2.md):
  - `/events/:id`: sinh viên đăng ký, vào danh sách chờ (hiện vị trí #n), hủy/rời hàng chờ có bước xác nhận; nút tắt kèm lý do khi không đủ điều kiện, ngoài thời gian đăng ký hoặc sự kiện đã bắt đầu. Hủy bằng version cũ (vừa được đôn chờ) báo lại và tải trạng thái mới, không hủy nhầm chỗ.
  - `/my-events`: đăng ký của sinh viên, lọc trạng thái, phân trang; trạng thái nằm trên URL.
  - `/participants?event=<id>`: organizer chọn sự kiện đã công bố, xem số đã đăng ký/chờ/còn trống, bảng sinh viên, lọc trạng thái. Ô tìm chỉ lọc trong trang hiện tại vì API chưa có tham số tìm kiếm; danh sách chọn sự kiện lấy tối đa 100 sự kiện.
  - Form sửa sự kiện: lỗi 409 `CAPACITY_BELOW_REGISTERED` hiện tại ô sức chứa, `REGISTERED_ELIGIBILITY_CHANGE` tại khoa/năm.
- Các route `scan`, `attendance`, `reports` hiện trang "Đang xây dựng"; `data.mockupFn` ghi hàm nguồn trong `public/mockup/app.js`.
- Giao diện dùng CSS của mockup (`src/styles.css`, phần đầu) + lớp Angular ở cuối file. Phần ngoài phạm vi (category, check-out, kết thúc thủ công) giữ trong comment `DEFERRED`, không xóa.

## Thêm một màn hình
1. Tạo `features/<module>/<ten>.page.ts` (standalone, signals, `ChangeDetectionStrategy.OnPush`).
2. Thêm route trong `app.routes.ts` (thay `comingSoon` nếu có) và mục menu trong `core/layout/navigation.ts`.
3. Gọi API qua `Api.request` (hoặc service trong feature). Guard chỉ ẩn giao diện; backend vẫn kiểm tra quyền.

## Kiểm thử giao diện
`node scripts/smoke/i1_ui.cjs <đường dẫn module playwright>` với stack đang chạy và tài khoản seed (scripts/seed-local.ps1). Script dùng Edge (`channel: msedge`).

I2: `./scripts/test-i2.ps1 -PlaywrightModule <đường dẫn module playwright>` chạy kiểm thử HTTP I2 rồi `scripts/smoke/i2_ui.cjs` trên stack test riêng (API 18081, Angular 14201; mặc định Edge, đổi bằng biến `I2_UI_CHANNEL`). Script tự tạo sinh viên/sự kiện trong database tmpfs, không chạm dữ liệu local. Ảnh chụp lưu ở `frontend/.angular/i2-*.png`.

## Phiên bản dependency — rà soát 12/11/2026

Framework/compiler Angular 21.2.26, CLI/build 21.2.29, TypeScript 5.9.3, RxJS 7.8.2; Node 24. Lockfile được tạo mới trên Linux rồi cài sạch bằng npm ci, không dùng --force/--legacy-peer-deps. Sau khi pull đổi lockfile, chạy npm.cmd ci.

`npm audit --omit=dev` hiện 0 cảnh báo; audit đầy đủ còn 16 moderate ở toolchain CLI (glob/minimatch), không còn high/critical. Đây là kiểm tra dependency npm tại thời điểm rà soát, không phải kết luận toàn hệ thống không còn lỗ hổng.
