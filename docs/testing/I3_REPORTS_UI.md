# I3 — Màn C: Báo cáo và CSV

Triển khai trên `feature/i3-frontend`, kế thừa backend I3 `1b99579`. Không thay API hoặc schema. Màn sinh viên quét camera thuộc phần A, chưa nằm trong phần triển khai này. Các phần ngoài phạm vi mockup tiếp tục giữ bằng comment/tạm vô hiệu hóa.

## Xem trên localhost

Chạy lệnh từ root repository. Docker Desktop phải đang chạy:

```powershell
./scripts/setup-local.ps1
./scripts/migrate-local.ps1
docker compose up --build -d --wait
```

Mở http://localhost:4200, đăng nhập bằng tài khoản **Organizer** của môi trường local rồi chọn **Báo cáo** trên thanh điều hướng. Tài khoản được hướng dẫn trong README gốc; không lưu mật khẩu thật trong tài liệu. Route: `/reports?event=<id>`.

Sự kiện phải đã công bố và thuộc Organizer hiện tại. Nếu chưa có sự kiện, trang có liên kết đến Sự kiện quản lý. Có thể xem báo cáo sự kiện chưa có sinh viên: các số đếm bằng 0, tỷ lệ không áp dụng và CSV có một dòng tổng quan.

Nếu chỉ sửa giao diện trên host, dùng backend Docker đang chạy:

```powershell
docker compose stop frontend
npm.cmd ci --prefix frontend
npm.cmd start --prefix frontend
```

Angular ở localhost:4200, proxy `/api` đến localhost:8080. Không đặt API key hoặc thông tin database vào frontend.

## Hành vi và quy tắc

- Chọn sự kiện dùng `OwnedEventPicker` có sẵn: chỉ lấy sự kiện đã công bố của Organizer, tối đa 100 sự kiện trong lần tải hiện hành. Bộ chọn này chưa có tìm kiếm/phân trang cho tổ chức có trên 100 sự kiện.
- Hiển thị đăng ký chính thức, có mặt, chưa ghi nhận/vắng, tỷ lệ, số chờ và số đã hủy. Dữ liệu lấy từ `AttendanceApi.list()` vì response đã chứa `summary` và chi tiết cùng snapshot; không ghép hai request thống kê và chi tiết khác thời điểm.
- Chỉ REGISTERED hiện hành được tính vào tổng tham gia và tỷ lệ. CANCELLED/WAITLISTED hiển thị "Không áp dụng", kể cả còn bằng chứng PRESENT cũ. Frontend không suy ra có mặt từ `result` thô.
- Trước `ends_at`: số liệu tạm, không kết luận vắng. Sau `ends_at`: hiển thị vắng theo số liệu backend. Tỷ lệ null hiện "Không áp dụng", không chuyển thành 0%. Sau sự kiện Organizer vẫn có thể chỉnh điểm danh; báo cáo không bị khóa cố định.
- Dữ liệu giữ nguyên theo thời điểm `generatedAt` hiển thị. Bấm **Tải lại** để lấy snapshot mới, kể cả khi vừa qua `ends_at`; trang không tự polling.
- Bộ lọc REGISTERED/WAITLISTED/CANCELLED/ALL chỉ đổi danh sách và CSV, không đổi quy tắc tính tổng quan. ALL gửi `status=` rỗng đến API; tham số bị bỏ trống hoàn toàn mặc định là REGISTERED. URL lưu `event`, `status`, `page`; đổi bộ lọc về trang đầu.
- Bảng phân trang 20 dòng. CSV do backend tạo, gồm **mọi trang** của bộ lọc và một snapshot mới lúc xuất; số liệu có thể khác màn hình nếu có thay đổi sau lần tải. Không xây CSV từ 20 dòng trên trình duyệt.
- File `.csv` giữ nguyên UTF-8 BOM, escape ký tự, chống công thức và thời gian +07:00 của backend. Không có XLSX/PDF. Trên 10.000 dòng trả 413 với hướng dẫn lọc, không tải file lỗi hoặc cắt dữ liệu âm thầm.
- Có trạng thái đang tải, danh sách trống, lỗi/thử lại, khóa nút trong lúc xuất. Phản hồi muộn của sự kiện/bộ lọc cũ không được ghi đè trang mới hoặc tải nhầm file.
- Route guard chỉ hỗ trợ giao diện. Backend vẫn kiểm tra phiên/vai trò/quyền sở hữu, kể cả gọi trực tiếp API. Student và Admin không có quyền báo cáo Organizer.

## Chạy kiểm thử tự động

Yêu cầu: Windows PowerShell, Node 24, Docker Desktop (Linux containers), Microsoft Edge. Từ root repository:

```powershell
npm.cmd ci --prefix frontend
npm.cmd ci --prefix scripts/smoke
./scripts/test-i3-reports.ps1
```

Playwright khóa phiên bản trong `scripts/smoke/package-lock.json`, độc lập với dependency Angular. Không cần tải Chromium nếu đã có Edge. Muốn dùng Chrome đã cài: đặt `$env:I3_UI_CHANNEL = 'chrome'` trước khi chạy. Có thể cung cấp `-PlaywrightModule <đường dẫn module playwright>` để dùng module riêng.

Runner tạo project `campus-events-i3-reports-test` dùng `compose.i3-test.yaml`, API **18084**, Angular **14204**, PostgreSQL tmpfs, mật khẩu/khóa QR ngẫu nhiên chỉ trong process; MAIL_ENABLED=false. Không dùng bí mật trong `.env`, volume hoặc database phát triển. Runner từ chối khi cổng đã có ứng dụng khác. Khi hoàn tất hoặc thất bại, runner dừng Angular và xóa container/network của riêng project test; dữ liệu tmpfs mất theo container. Các biến môi trường được trả về giá trị ban đầu.

Các tình huống sử dụng backend thật gồm tạo/công bố sự kiện, đăng ký/chờ/hủy, điểm danh thủ công, số liệu trước/sau kết thúc, phân trang, tải và đọc file CSV, phiên/quyền truy cập. Chỉ các trường hợp lỗi, phản hồi muộn và hết phiên dùng chặn request trong Playwright. Mốc kết thúc sự kiện được điều chỉnh trực tiếp trong **database test riêng** để kiểm thử nhanh, không chờ hết sự kiện ngoài đời.

| Ca kiểm thử | Kết quả cần đạt |
| --- | --- |
| 21 đăng ký chính thức, 2 có mặt, 1 chờ, 1 đã hủy có PRESENT cũ | 2/21 = 9,5%; không cộng người chờ/hủy |
| Trước kết thúc | 19 chưa ghi nhận, chưa tính vắng |
| Sau kết thúc | 19 vắng, CSV phản ánh đúng |
| Trang 2 rồi tải CSV | CSV có đủ 21 lượt chính thức |
| ALL | Gửi `status=`; đủ 23 lượt, người chờ/hủy không áp dụng |
| CSV có tiếng Việt, dấu phẩy, dấu ngoặc kép và tên bắt đầu bằng `=` | BOM, escape, chống công thức và +07:00 được giữ |
| Sự kiện chưa có đăng ký | 0 lượt, tỷ lệ không áp dụng, CSV chỉ có tổng quan |
| Đổi bộ lọc, tải lại trang, Back | URL và dữ liệu khớp nhau |
| API lỗi rồi thử lại | Không hiển thị số cũ như dữ liệu hiện tại; tải lại thành công |
| CSV vượt giới hạn | Thông báo 413, không tải file lỗi, thử lại được |
| Phản hồi muộn khi đổi sự kiện | Không ghi đè số liệu hoặc tải CSV của sự kiện cũ |
| Student/Admin và Organizer khác | Guard điều hướng đúng; API trực tiếp trả 403/404 |
| Chưa đăng nhập hoặc nhận 401 trong lúc xuất | API trả 401; giao diện về đăng nhập, không tải file JSON lỗi |
| Desktop và điện thoại | Bảng cuộn bên trong, trang không tràn ngang, không có lỗi JavaScript chưa xử lý |

Bằng chứng lưu trong `frontend/.angular/i3-reports/` (Git ignore): log Compose/Angular, `desktop.png`, `mobile.png`, các CSV thực tải và `results.json` liệt kê ca đạt. Nếu thất bại có thêm `failure.png`; runner trả exit code lỗi. Không đưa tài khoản/khóa thử vào Git.

## Phạm vi nghiệm thu

Tự kiểm tra ngày **22/11/2026**: build production PASS; 13 nhóm kiểm thử trình duyệt trên Edge với API/PostgreSQL thật PASS. Đã xem ảnh desktop/mobile, điều chỉnh độ rộng cột để tên/email đọc được khi cuộn ngang trên điện thoại. `npm audit --prefix scripts/smoke` trả 0 cảnh báo ở lần chạy này; đây chỉ là dependency của bộ kiểm thử, không thay kết quả audit toàn ứng dụng. Stack test và Angular test đã được dừng sau kiểm thử.

Build production: `npm.cmd run build --prefix frontend`. Kiểm thử tự động này xác nhận màn C trên stack local, không thay QA/review độc lập, nghiệm thu CP3/CP4, kiểm thử camera của màn A hoặc kiểm thử deploy/cloud.
