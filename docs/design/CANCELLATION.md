# Hủy và đăng ký lại — một dòng hiện hành

Cho hủy khi thời gian server < starts_at; giữ attendance và lịch sử. Báo cáo chỉ tính người REGISTERED nên người đã hủy không tăng số tham dự.

## Backend phải thực hiện
Khóa event -> tài khoản -> registration; xác minh quyền/chủ sở hữu/thời hạn; cập nhật trạng thái, thời gian/version và history. Hủy REGISTERED giải phóng chỗ; đôn FIFO với kiểm tra điều kiện rồi ghi outbox cùng transaction. Không gọi nhà cung cấp email trong transaction. Đã triển khai bằng RegistrationServiceImpl/WaitlistServiceImpl trong I2, xem [API I2](../api/I2.md).

## Đã có trong schema
Khi đổi CANCELLED -> REGISTERED/WAITLISTED, BEFORE trigger chụp attendance cũ, reset NOT_RECORDED bằng method SYSTEM, session_id NULL, actor là sinh viên yêu cầu đăng ký lại, tăng version và ghi attendance_history. Sau đó đặt lại timestamp lượt mới, bỏ cancelled_at, tăng registration version. AFTER trigger ghi REREGISTER; service không ghi trùng entry này. Mọi thay đổi cùng commit/rollback.

SYSTEM chỉ dùng khi reset lồng trong trigger đăng ký, không phải phương thức điểm danh của người dùng. Ghi QR/manual thông thường vẫn yêu cầu REGISTERED. Không giữ ưu tiên FIFO cũ, không mang PRESENT cũ sang lượt mới. Identity event/student bất biến.

SQL test: database/tests/02_registration_reset.sql. Chỉ áp dụng bản schema mới lên database rỗng; chưa có migration nâng cấp DB cũ.

## Tăng sức chứa
Service khóa event, kiểm tra quyền/version, capacity nguyên dương và không thấp hơn số Registered, tăng rồi đôn FIFO tới khi hết chỗ/hết người hợp lệ; history/outbox cùng transaction. Đã có backend I2. Đôn sau giờ đóng đăng ký đến trước starts_at; người mới không vượt người chờ cũ hợp lệ.
