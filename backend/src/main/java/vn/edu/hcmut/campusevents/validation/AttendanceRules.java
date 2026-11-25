package vn.edu.hcmut.campusevents.validation;

import org.springframework.stereotype.Component;

import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.model.*;

import java.time.OffsetDateTime;

@Component
public class AttendanceRules {
    public boolean window(Event event, OffsetDateTime now) {
        return event.status() == EventStatus.PUBLISHED
                && !now.isBefore(event.startsAt().minusMinutes(30))
                && now.isBefore(event.endsAt());
    }

    public void requireWindow(Event event, OffsetDateTime now) {
        if (!window(event, now))
            throw new ApiException(
                    409,
                    "ATTENDANCE_CLOSED",
                    "Chỉ điểm danh từ 30 phút trước bắt đầu đến trước khi sự kiện kết thúc.");
    }

    public void requireManualTime(Event event, OffsetDateTime now) {
        if (now.isBefore(event.startsAt().minusMinutes(30)))
            throw new ApiException(409, "ATTENDANCE_NOT_OPEN", "Chưa đến giờ ghi nhận điểm danh.");
    }

    public boolean active(Event event, AttendanceSession session, OffsetDateTime now) {
        return window(event, now)
                && session.closedAt() == null
                && !now.isBefore(session.openedAt())
                && now.isBefore(session.expiresAt());
    }

    public void requireRegistered(Registration registration) {
        if (!registration.status().equals("REGISTERED"))
            throw new ApiException(
                    409,
                    "REGISTRATION_NOT_CONFIRMED",
                    "Chỉ đăng ký chính thức mới được điểm danh.");
    }

    public String state(String registrationStatus, Attendance attendance, boolean ended) {
        if (!"REGISTERED".equals(registrationStatus)) return "NOT_APPLICABLE";
        if (attendance != null && attendance.result().equals("PRESENT")) return "PRESENT";
        return ended ? "ABSENT" : "NOT_RECORDED";
    }
}
