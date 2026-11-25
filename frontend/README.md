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
features/attendance      I3: models + AttendanceApi (12 endpoint), /attendance (organizer: phiên QR, danh sách, thủ công, lịch sử)
features/scan            I3: /scan (sinh viên quét QR, @zxing/browser)
features/reports         I3: /reports (organizer: thống kê, chi tiết phân trang, tải CSV theo bộ lọc)
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
- I3: `/attendance` đã có phiên QR/điểm danh thủ công/lịch sử; `/reports` đã nối báo cáo + CSV; `/scan` quét QR bằng camera → xem trước → Xác nhận → check-in. Trang `/events/:id` của sinh viên có kết quả điểm danh, thời gian/phương thức ghi nhận và liên kết quét QR trong cửa sổ điểm danh. Mockup tham khảo giữ trong `public/mockup/app.js`.
- Giao diện dùng CSS của mockup (`src/styles.css`, phần đầu) + lớp Angular ở cuối file. Phần ngoài phạm vi (category, check-out, kết thúc thủ công) giữ trong comment `DEFERRED`, không xóa.

## I3 — phần nền dùng chung và chia việc

Hợp đồng API: `docs/api/I3.md`. Phần nền đã có, các màn hình chỉ cần dùng lại:

- `features/attendance/attendance.models.ts`: kiểu dữ liệu I3, `parseCheckInQr(text)` (đọc nội dung QR, trả null nếu không phải mã BKevent), nhãn huy hiệu `ATTENDANCE_STATE_BADGE`, `METHOD_LABEL`.
- `features/attendance/attendance-api.service.ts` (`AttendanceApi`): đủ 12 endpoint. `reportCsv()` và `qrSvg()` trả `Blob` qua `Api.requestBlob`; danh sách/CSV dùng `AttendanceFilter` (`'ALL'` gửi `status=` rỗng vì thiếu tham số thì server mặc định REGISTERED).
- `features/events/owned-event-picker.ts`: `OwnedEventPicker` (khai báo `providers: [OwnedEventPicker]` trên trang) + `<app-owned-event-select>` (ô chọn ở header) + `<app-owned-event-states>` (đang tải/lỗi/chưa có sự kiện). Sự kiện chọn nằm trên URL `?event=<id>`. Mẫu dùng: `participants.page.ts`, `attendance.page.ts`.
- Dùng chung khác: `<app-pager>`, `pageFromQuery`/`pageToQuery`, `formatDateTime`…, `ToastService`.

| Màn | Route / file | Người làm |
| --- | --- | --- |
| A. Điểm danh QR (sinh viên) | `/scan` → `features/scan/scan.page.ts` | Người 2 |
| B. Điểm danh (organizer) | `/attendance` → `features/attendance/attendance.page.ts` | Trinh — đã xong |
| C. Báo cáo + CSV (organizer) | `/reports` → `features/reports/reports.page.ts` + `.html` + `.css` | Đã triển khai; xem kiểm thử bên dưới |

Quy ước để không xung đột: mỗi người chỉ sửa trong thư mục màn của mình; route đã khai báo sẵn trong `app.routes.ts`. Cần đổi file dùng chung (models, service, `styles.css`) thì báo nhóm trước. Màn A tự thêm thư viện đọc QR (`package.json`) trong PR của mình; camera chỉ chạy trên HTTPS hoặc `localhost`. Không gọi check-in ngay khi camera đọc được mã: preview → người dùng bấm Xác nhận → check-in; 409 `CONFIRMATION_STALE` thì preview lại và hỏi lại.

Chạy local cần migration I3 và khóa QR: `./scripts/setup-local.ps1` (thêm `ATTENDANCE_TOKEN_KEY` vào `.env`) rồi `./scripts/migrate-local.ps1`; thiếu khóa thì mở QR trả 503 `QR_KEY_NOT_CONFIGURED`.

## Thêm một màn hình
1. Tạo `features/<module>/<ten>.page.ts` (standalone, signals, `ChangeDetectionStrategy.OnPush`).
2. Thêm route trong `app.routes.ts` (thay `comingSoon` nếu có) và mục menu trong `core/layout/navigation.ts`.
3. Gọi API qua `Api.request` (hoặc service trong feature). Guard chỉ ẩn giao diện; backend vẫn kiểm tra quyền.

## Kiểm thử giao diện
`node scripts/smoke/i1_ui.cjs <đường dẫn module playwright>` với stack đang chạy và tài khoản seed (scripts/seed-local.ps1). Script dùng Edge (`channel: msedge`).

I2: `./scripts/test-i2.ps1 -PlaywrightModule <đường dẫn module playwright>` chạy kiểm thử HTTP I2 rồi `scripts/smoke/i2_ui.cjs` trên stack test riêng (API 18081, Angular 14201; mặc định Edge, đổi bằng biến `I2_UI_CHANNEL`). Script tự tạo sinh viên/sự kiện trong database tmpfs, không chạm dữ liệu local. Ảnh chụp lưu ở `frontend/.angular/i2-*.png`.

I3 màn B: `node scripts/smoke/i3_attendance_ui.cjs <module playwright>` trên stack test I3 (`compose.i3-test.yaml`, API 18082) với Angular trỏ `/api` tới API đó; biến `TEST_ACCOUNT_PASSWORD`, `I3_UI_BASE_URL` (mặc định http://127.0.0.1:14202). Script tự tạo sự kiện bắt đầu sau 10 phút và ba sinh viên trong database tmpfs.

Điểm danh trên trang chi tiết: `./scripts/test-i3-student-attendance.ps1` (từ root, sau khi chạy `npm.cmd ci --prefix frontend` và `npm.cmd ci --prefix scripts/smoke`). Chạy Angular 14206 + Edge với response API giả lập theo hợp đồng; không cần Docker, không dùng database hoặc tài khoản thật. Kiểm tra QR/thủ công, hủy/đăng ký lại, phản hồi muộn, hết giờ, lỗi/thử lại và mô tả không có dấu cách trên desktop/mobile. Log, ảnh và kết quả ở `frontend/.angular/student-attendance/`. Kiểm thử API/PostgreSQL thật vẫn dùng `./scripts/test-i3-ui.ps1`; bộ scan đã thêm kiểm tra kết quả trên chi tiết sau khi quét.

`MyAttendanceComponent` lấy `attendanceState` từ backend, không suy ra Có mặt từ bằng chứng PRESENT của lượt đã hủy. Đổi version/trạng thái đăng ký xóa kết quả đang hiển thị và tải lại; nút Tải lại đồng thời cập nhật trạng thái đăng ký. Khi qua thời điểm mở QR/kết thúc, trang gọi lại API. Mô tả dài tự xuống dòng và giữ xuống dòng do người nhập, không cắt nội dung.

I3 màn C, từ **root repository**:

```powershell
npm.cmd ci --prefix frontend
npm.cmd ci --prefix scripts/smoke
./scripts/test-i3-reports.ps1
```

Runner tự chạy API 18084 + Angular 14204 và PostgreSQL tmpfs thuộc project `campus-events-i3-reports-test`, tạo dữ liệu thử, dùng Edge headless, tắt email, rồi dừng stack test kể cả khi kiểm thử thất bại. Playwright được khóa phiên bản trong `scripts/smoke/package-lock.json`, độc lập dependency ứng dụng; không cần cài browser bổ sung nếu máy đã có Edge. Có thể dùng `-PlaywrightModule <đường dẫn module playwright>` nếu đã cài module riêng. Không dùng `.env` hoặc database phát triển. Log, ảnh desktop/mobile và CSV thực tải ở `frontend/.angular/i3-reports/` (Git ignore).

Màn `/reports?event=<id>` chỉ dành cho Organizer. Chọn sự kiện đã công bố → xem thống kê → lọc lượt đăng ký → tải CSV. Lọc/phân trang được giữ trên URL; CSV chứa toàn bộ dữ liệu của bộ lọc, không chỉ trang đang xem. Tổng quan luôn tính trên REGISTERED hiện hành. Trước `ends_at` hiển thị số liệu tạm/chưa ghi nhận; sau đó mới hiển thị vắng. Không có đăng ký thì tỷ lệ là "Không áp dụng". Nút Tải lại lấy snapshot mới; không tự cập nhật liên tục. Hướng dẫn, phạm vi kiểm thử và giới hạn: [I3_REPORTS_UI.md](../docs/testing/I3_REPORTS_UI.md).

## Phiên bản dependency — rà soát 12/11/2026

Framework/compiler Angular 21.2.26, CLI/build 21.2.29, TypeScript 5.9.3, RxJS 7.8.2; Node 24. Lockfile được tạo mới trên Linux rồi cài sạch bằng npm ci, không dùng --force/--legacy-peer-deps. Sau khi pull đổi lockfile, chạy npm.cmd ci.

`npm audit --omit=dev` hiện 0 cảnh báo; audit đầy đủ còn 16 moderate ở toolchain CLI (glob/minimatch), không còn high/critical. Đây là kiểm tra dependency npm tại thời điểm rà soát, không phải kết luận toàn hệ thống không còn lỗ hổng.
