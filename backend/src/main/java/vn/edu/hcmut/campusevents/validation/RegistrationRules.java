package vn.edu.hcmut.campusevents.validation;

import org.springframework.stereotype.Component;

import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.model.*;

import java.time.OffsetDateTime;

@Component
public class RegistrationRules {
    public boolean eligible(Event event, long department, int year) {
        return (event.departmentIds().isEmpty() || event.departmentIds().contains(department))
                && (event.studyYears().isEmpty() || event.studyYears().contains(year));
    }

    public boolean open(Event event, OffsetDateTime now) {
        return event.status() == EventStatus.PUBLISHED
                && !now.isBefore(event.registrationOpensAt())
                && now.isBefore(event.registrationClosesAt())
                && now.isBefore(event.startsAt());
    }

    public void requireOpen(Event event, OffsetDateTime now) {
        if (!open(event, now))
            throw new ApiException(
                    409, "REGISTRATION_CLOSED", "Chưa đến giờ hoặc đã hết hạn đăng ký.");
    }

    public void requireBeforeStart(Event event, OffsetDateTime now) {
        if (!now.isBefore(event.startsAt()))
            throw new ApiException(
                    409, "EVENT_STARTED", "Sự kiện đã bắt đầu; không thể hủy đăng ký.");
    }

    public void requireEligible(Event event, User user) {
        if (user.departmentId() == null
                || user.studyYear() == null
                || !eligible(event, user.departmentId(), user.studyYear()))
            throw new ApiException(
                    403, "NOT_ELIGIBLE", "Bạn không thuộc khoa/năm được tham gia sự kiện.");
    }
}
