# Tự thử I3 trên máy local

Mở Docker Desktop, đợi engine chạy; cần Python và PowerShell. Mở terminal tại **root repository**, thư mục chứa compose.yaml. Các lệnh dưới đây dùng API thật và PostgreSQL thật của một project demo riêng, không phải mockup localStorage. Giao diện camera trên app chưa tích hợp; thao tác quét được thay bằng việc đọc payload QR đã tải.

## Thử nhanh: xem QR → xem trước → xác nhận → báo cáo

```powershell
.\scripts\demo-i3.ps1 -Action Start
```

Script build/start project campus-events-i3-demo, API cổng 18083, database tmpfs riêng và MAIL_ENABLED=false. Tạo một sự kiện đang trong khung mở QR, một Student REGISTERED và một Student WAITLISTED. Không sửa `.env`, volume hoặc dữ liệu của app local. Khóa/mật khẩu thử được tự sinh, giữ trong backend/target/i3-demo/config.json (Git ignore), không in ra console.

Mở `backend/target/i3-demo/qr.svg` bằng trình duyệt để nhìn QR thật. Phiên mới mặc định 10 phút; Start/Refresh nhận `-DurationMinutes 1` đến `30`. Hạn thực tế hiển thị trong console theo giờ Việt Nam. Quét bằng ứng dụng camera thông thường chỉ đọc JSON; chưa tự mở màn check-in. Lần build đầu có thể mất vài phút; log tại backend/target/i3-demo/start.log.

```powershell
# Chỉ đọc, chưa thêm điểm danh.
.\scripts\demo-i3.ps1 -Action Preview
.\scripts\demo-i3.ps1 -Action Report

# Tương đương sinh viên bấm Xác nhận trong giao diện tương lai.
.\scripts\demo-i3.ps1 -Action Confirm
.\scripts\demo-i3.ps1 -Action Report
.\scripts\demo-i3.ps1 -Action Export
```

Kết quả mong đợi từ môi trường mới: trước Confirm, presentCount=0; sau Confirm, presentCount=1, attendanceRate=100.0. Có một người đang chờ nhưng không được tính vào mẫu số. File CSV nằm tại backend/target/i3-demo/report.csv.

Gọi Confirm lần nữa vẫn trả PRESENT hiện hành, không tăng số người hoặc ghi trùng lịch sử. Đóng QR không xóa kết quả đã ghi.

## Thử điều chỉnh thủ công của Organizer

```powershell
.\scripts\demo-i3.ps1 -Action ManualClear -Reason 'Đính chính theo biên bản dự phòng'
.\scripts\demo-i3.ps1 -Action History
.\scripts\demo-i3.ps1 -Action Report
```

ManualClear đổi sang NOT_RECORDED, giữ lịch sử và tăng version; không xóa bản ghi. Khi sự kiện chưa kết thúc, absentCount vẫn null. Có thể ghi PRESENT thủ công bằng:

```powershell
.\scripts\demo-i3.ps1 -Action ManualPresent -Reason 'Đối chiếu danh sách dự phòng'
```

Thao tác chỉ được phép với Organizer phụ trách, đăng ký chính thức và lý do không rỗng. Nếu kết quả đã giống hiện hành, API trả hiện trạng và không ghi audit trùng.

## Thử các trường hợp bị chặn

```powershell
# Người đang chờ không được xem trước/điểm danh: REGISTRATION_NOT_CONFIRMED.
.\scripts\demo-i3.ps1 -Action Preview -Student waiting

# Xác nhận sau khi Organizer đã đóng phiên: QR_SESSION_INVALID.
.\scripts\demo-i3.ps1 -Action Preview
.\scripts\demo-i3.ps1 -Action Close
.\scripts\demo-i3.ps1 -Action Confirm
```

Một trường hợp khác: Preview → ManualClear → Confirm với bản xem trước cũ bị CONFIRMATION_STALE khi kết quả hiện hành đã thay đổi. Chạy lại Preview, kiểm tra thông tin rồi Confirm. Mỗi lần xem trước trả version của event/registration/attendance để chặn thao tác cũ; riêng khi đã PRESENT thì xác nhận lặp giữ kết quả đó.

Phiên hết hạn cũng bị chặn. Để có mã mới, Close rồi Refresh; Refresh một phiên đang active giữ nguyên mã và hạn hiện tại, không gia hạn âm thầm:

```powershell
.\scripts\demo-i3.ps1 -Action Close
.\scripts\demo-i3.ps1 -Action Refresh
.\scripts\demo-i3.ps1 -Action Preview
```

Ví dụ thử quyền chọn thời hạn của Organizer: Close rồi chạy `./scripts/demo-i3.ps1 -Action Refresh -DurationMinutes 1`; sau một phút, xác nhận bằng mã đó sẽ bị từ chối. Chỉ Organizer phụ trách được điều khiển phiên và hạn vẫn không vượt ends_at.

## Dừng/reset demo

```powershell
.\scripts\demo-i3.ps1 -Action Stop
```

DB demo là tmpfs nên dữ liệu thử mất khi dừng container. Start lại tạo môi trường/fixtures mới để thử từ đầu. App local bình thường vẫn được giữ nguyên. Các file QR/CSV cũ còn trên máy nhưng mã cũ không còn hợp lệ sau khi DB demo đã dừng; Start tải lại QR mới.

## Chạy bộ kiểm thử tự động

```powershell
mvn -f backend/pom.xml test
.\scripts\test-i3.ps1
```

Autotest dùng project campus-events-i3-test và cổng 18082, tách cả demo lẫn app. Test bao gồm quyền/CSRF, QR thật, hạn dùng/cắt đúng ends_at, concurrency, phiên bản xác nhận, reset khi đăng ký lại, audit rollback, báo cáo/CSV và giới hạn export. Tất cả mail bị tắt trong I3 demo/test.

| Môi trường | Cổng | Dữ liệu |
| --- | --- | --- |
| App local | FE 4200, API 8080, DB 5432 | Volume phát triển hiện có |
| I3 autotest | API 18082 | DB test tmpfs |
| I3 demo từng bước | API 18083 | DB demo tmpfs |

Nếu cổng 18083 bị chiếm, dừng project demo cũ bằng Stop rồi Start lại. Nếu chỉ cần dùng lại mã hiện hành khi demo đang chạy, Start giữ event/session active và xóa bản xem trước cũ để yêu cầu xác nhận mới. Khi event mẫu đã kết thúc, Start tạo event mẫu mới.

## Cập nhật app local đang có DB

```powershell
.\scripts\setup-local.ps1
.\scripts\migrate-local.ps1
docker compose up --build -d --wait
.\scripts\smoke\local.ps1
```

Migration chỉ thay thế hàm kiểm tra QR lúc ghi, chạy lại được và không reset dữ liệu. --wait chờ container sẵn sàng trước khi smoke; trên máy chạy nhiều stack, khởi động lạnh có thể hơn một phút. Không chạy lại baseline lên DB hiện hữu, không dùng down -v để cập nhật. Đặc tả API: [I3.md](../api/I3.md).
