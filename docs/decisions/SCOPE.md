# Quyết định phạm vi — 03/11/2026

Đã chốt bởi người dùng trong chat:
- Một lượt điểm danh đầu vào; không dùng check-out.
- Sức chứa bắt buộc là số nguyên dương; cho phép tăng. Tăng sức chứa và đôn FIFO trong cùng transaction.
- Cho hủy trước starts_at, kể cả đã có dữ liệu attendance; không xóa bằng chứng điểm danh.
- Sự kiện kết thúc theo ends_at; không thêm cờ kết thúc thủ công.
- Tạm bỏ loại sự kiện. Ví dụ nếu phát triển sau: Học thuật, Nghề nghiệp, Văn hóa, Thể thao. Chưa thêm cột category.
- Giới hạn khoa/năm là cấu hình của sự kiện, được chọn nhiều. Hồ sơ một sinh viên hiện có một khoa và một năm. Ghép điều kiện khoa AND năm; trong mỗi nhóm là OR. Không có dòng giới hạn nghĩa là tất cả.
- Bảo vệ Admin cuối cùng đang ACTIVE; ngăn tự khóa; không mặc định Admin được sửa điểm danh.
- Chỉ xuất CSV. Đây là quyết định thực hiện hiện tại; báo cáo cũ ghi CSV/Excel chưa được chỉnh sửa.
- Phần mockup vượt phạm vi phải giữ nguyên mã và comment/tạm vô hiệu hóa khi tích hợp, không xóa.

## Quy tắc còn cần xác nhận
- Thời gian được mở QR, có cho mở trước starts_at không.

- Một organizer/sự kiện là mô hình hiện tại, chưa phải yêu cầu được xác nhận trong lượt này.

## Bảo tồn mockup
Bản sao nguyên trạng nằm tại docs/references/mockup-original; đây là nguồn tham khảo, không phải frontend Angular đang chạy. Không chỉnh bản gốc. Khi chuyển giao diện sang Angular, giữ các khối check-out, chọn chế độ hai lượt, category và kết thúc thủ công trong comment có nhãn DEFERRED và lý do. Không đưa các khối đó vào UI hoạt động. Đã có bản mockup làm việc đồng bộ trong frontend/public/mockup; các khối cũ được giữ trong comment/tạm vô hiệu hóa. Chưa chuyển nghiệp vụ sang Angular/API.

## Chốt mô hình đăng ký
Một dòng registrations hiện hành cho mỗi cặp event/student, UNIQUE(event_id,student_id), tái sử dụng sau hủy; lưu mọi chuyển trạng thái trong registration_history. Nếu đăng ký lại khi có attendance cũ, phải lưu snapshot và reset kết quả trong cùng transaction, không dùng PRESENT cũ. Đã có trigger reset SYSTEM + snapshot attendance_history và REREGISTER history trong cùng transaction khi tái sử dụng dòng. Backend I2 đã gọi quy trình này. Việc chỉ mở QR từ starts_at vẫn là đề xuất, chưa coi người dùng đã chốt mốc thời gian này.

## FIFO và email I2 — 12/11/2026

Người dùng chốt đôn người chờ hợp lệ, giữ luồng đơn giản, không bổ sung quy trình riêng Admin khóa/mở cho FIFO. Cho đôn sau đóng đăng ký đến trước starts_at khi có chỗ. Phương án triển khai: bỏ qua người không hợp lệ, ghi SKIP, giữ dòng WAITLISTED/timestamp; lần đăng ký/hủy/sửa tiếp theo kiểm tra lại. Chưa có tác vụ quét riêng khi hồ sơ đổi; không thêm cơ chế mất/khôi phục ưu tiên theo trạng thái Admin.

Email I2 dùng Brevo HTTP API, ba mốc xác nhận có chỗ, đôn từ hàng chờ và thay đổi địa điểm/thời gian. Không có reminder. Ghi outbox cùng transaction, gửi sau commit; gửi thật opt-in qua biến môi trường. Người dùng đã xác nhận nhận được một thư thử thật; kiểm thử tự động I2 chỉ gọi mail giả lập. Xem [I2.md](../api/I2.md) về giới hạn gửi và trạng thái SENT.

## Vai trò cố định — quyết định ngày 04/11/2026

Theo yêu cầu người dùng trong chat: bỏ thay đổi vai trò (UC-24). Mỗi tài khoản chỉ có một vai trò cố định sau khi tạo, không đổi qua lại giữa STUDENT/ORGANIZER/ADMIN. Hệ thống vẫn phân quyền ba nhóm riêng biệt; Admin không mặc nhiên có quyền Organizer. Sinh viên tự đăng ký; Admin cấp tài khoản Organizer; tài khoản Admin được thiết lập khi triển khai. Tài khoản cũ giữ vai trò hiện có, không chuyển đổi hoặc tạo lại dữ liệu. UC-21–23 tiếp tục áp dụng; chức năng khóa/mở vẫn giữ. Quyết định này thay phần UC-24 trong đặc tả Word trước đó; không coi UC-24 là hạng mục còn thiếu để nghiệm thu phiên bản hiện tại.

## Danh mục khoa/chương trình — quyết định ngày 04/11/2026

Sử dụng đúng 12 tên và thứ tự người dùng cung cấp, gồm CT KỸ SƯ CHẤT LƯỢNG CAO PFIEV. Nguồn định nghĩa tại `catalog/DepartmentCatalog.java`; mã code là khóa nội bộ. Danh mục được khởi tạo khi backend chạy, độc lập với seed tài khoản mẫu, dùng chung cho đăng ký sinh viên và giới hạn khoa của sự kiện. Giữ nguyên ID/khóa ngoại hiện có; các lựa chọn mẫu ngoài danh mục không được đưa vào lựa chọn mới.
