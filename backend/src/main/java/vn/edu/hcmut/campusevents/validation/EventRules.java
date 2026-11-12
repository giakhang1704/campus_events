package vn.edu.hcmut.campusevents.validation;

import org.springframework.stereotype.Component;

import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.model.Event;
import vn.edu.hcmut.campusevents.model.EventContent;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;

/** Pure business rules, independent of HTTP and database access. */
@Component
public class EventRules {
    public void validateContent(EventContent content) {
        Map<String, String> fields = new LinkedHashMap<>();
        if (!content.registrationOpensAt().isBefore(content.registrationClosesAt())) {
            fields.put("registrationClosesAt", "Đóng đăng ký phải sau mở đăng ký.");
        }
        if (content.registrationClosesAt().isAfter(content.startsAt())) {
            fields.put("startsAt", "Bắt đầu phải bằng hoặc sau đóng đăng ký.");
        }
        if (!content.startsAt().isBefore(content.endsAt())) {
            fields.put("endsAt", "Kết thúc phải sau bắt đầu sự kiện.");
        }
        if (new HashSet<>(content.departmentIds()).size() != content.departmentIds().size()) {
            fields.put("departmentIds", "Không chọn khoa trùng nhau.");
        }
        if (new HashSet<>(content.studyYears()).size() != content.studyYears().size()) {
            fields.put("studyYears", "Không chọn năm học trùng nhau.");
        }
        if (!fields.isEmpty()) {
            throw new ApiException(
                    400, "INVALID_EVENT", "Vui lòng kiểm tra thông tin sự kiện.", fields);
        }
    }

    public void requireVersion(Event event, Integer version) {
        if (version == null) {
            throw new ApiException(
                    400,
                    "VERSION_REQUIRED",
                    "Cần phiên bản sự kiện để lưu thay đổi.",
                    Map.of("version", "Vui lòng tải lại sự kiện trước khi lưu."));
        }
        if (event.version() != version) {
            throw new ApiException(
                    409,
                    "VERSION_CONFLICT",
                    "Sự kiện đã được cập nhật. Hãy tải lại và đối chiếu nội dung trước khi lưu.");
        }
    }

    public void validateParticipantImpact(
            Event before, EventContent next, int registered, int waiting) {
        if (next.capacity() < registered) {
            throw new ApiException(
                    409,
                    "CAPACITY_BELOW_REGISTERED",
                    "Sức chứa không được thấp hơn số đã đăng ký.");
        }
        if (next.capacity() > before.capacity() && waiting > 0) {
            throw new ApiException(
                    409,
                    "WAITLIST_PROCESSING_REQUIRED",
                    "Chưa thể tăng sức chứa khi còn người chờ. Vui lòng xử lý danh sách chờ"
                            + " trước.");
        }
        if (registered == 0) return;
        boolean eligibilityChanged =
                !new HashSet<>(before.departmentIds()).equals(new HashSet<>(next.departmentIds()))
                        || !new HashSet<>(before.studyYears())
                                .equals(new HashSet<>(next.studyYears()));
        if (eligibilityChanged) {
            throw new ApiException(
                    409,
                    "REGISTERED_ELIGIBILITY_CHANGE",
                    "Chưa thể đổi giới hạn đối tượng khi đã có người đăng ký; cần đối chiếu đăng ký"
                            + " hiện có.");
        }
        boolean importantChange =
                !before.location().equals(next.location().trim())
                        || !before.registrationOpensAt().isEqual(next.registrationOpensAt())
                        || !before.registrationClosesAt().isEqual(next.registrationClosesAt())
                        || !before.startsAt().isEqual(next.startsAt())
                        || !before.endsAt().isEqual(next.endsAt());
        if (importantChange) {
            throw new ApiException(
                    409,
                    "PARTICIPANT_NOTIFICATION_REQUIRED",
                    "Đổi thời gian hoặc địa điểm cần thông báo cho người đã đăng ký. Chức năng này"
                            + " chưa sẵn sàng.");
        }
    }
}
