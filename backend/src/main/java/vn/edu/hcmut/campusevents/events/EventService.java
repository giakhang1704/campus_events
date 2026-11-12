package vn.edu.hcmut.campusevents.events;

import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import vn.edu.hcmut.campusevents.auth.AuthPrincipal;
import vn.edu.hcmut.campusevents.auth.AuthService;
import vn.edu.hcmut.campusevents.common.ApiException;
import vn.edu.hcmut.campusevents.events.dto.EventPage;
import vn.edu.hcmut.campusevents.events.dto.EventRequest;
import vn.edu.hcmut.campusevents.events.model.Event;
import vn.edu.hcmut.campusevents.events.model.EventStatus;

@Service
public class EventService {
    private final EventRepository events;
    private final EventRules rules;
    private final AuthService auth;

    public EventService(EventRepository events, EventRules rules, AuthService auth) {
        this.events = events;
        this.rules = rules;
        this.auth = auth;
    }

    // A single snapshot keeps event fields and the two eligibility collections consistent.
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public EventPage listPublished(String query, int page, int size) {
        var rows = events.listPublished(query.strip(), page, size);
        return new EventPage(rows.stream().limit(size).toList(), page, size, rows.size() > size);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Event getPublished(long id) {
        // Do not fall back to an ownership check: this route never reveals drafts.
        return events.findPublished(id)
                .orElseThrow(() -> new ApiException(404, "EVENT_NOT_FOUND", "Không tìm thấy sự kiện đã công bố."));
    }

    @Transactional(readOnly = true)
    public EventPage listOwned(AuthPrincipal actor, int page, int size) {
        var rows = events.listOwned(actor.userId(), page, size);
        return new EventPage(rows.stream().limit(size).toList(), page, size, rows.size() > size);
    }

    @Transactional(readOnly = true)
    public Event getOwned(AuthPrincipal actor, long id) {
        return owned(actor, id, false);
    }

    @Transactional
    public Event create(AuthPrincipal actor, EventRequest content) {
        auth.requireActiveOrganizer(actor);
        validate(content);
        return events.find(events.insert(actor.userId(), content), false).orElseThrow();
    }

    @Transactional
    public Event update(AuthPrincipal actor, long id, EventRequest content) {
        auth.requireActiveOrganizer(actor);
        Event before = owned(actor, id, true);
        rules.requireVersion(before, content.version());
        validate(content);
        rules.validateParticipantImpact(before, content,
                events.countParticipants(id, "REGISTERED"), events.countParticipants(id, "WAITLISTED"));
        if (!events.update(before, content)) throw versionConflict();
        return events.find(id, false).orElseThrow();
    }

    @Transactional
    public Event publish(AuthPrincipal actor, long id, int version) {
        auth.requireActiveOrganizer(actor);
        Event before = owned(actor, id, true);
        rules.requireVersion(before, version);
        if (before.status() == EventStatus.PUBLISHED) return before;
        validate(EventRequest.from(before));
        if (!events.publish(before)) throw versionConflict();
        return events.find(id, false).orElseThrow();
    }

    private Event owned(AuthPrincipal actor, long id, boolean lock) {
        // A missing event and someone else's event have the same response, including drafts.
        return events.find(id, lock).filter(event -> event.organizerId() == actor.userId())
                .orElseThrow(() -> new ApiException(404, "EVENT_NOT_FOUND", "Không tìm thấy sự kiện trong phạm vi của bạn."));
    }

    private void validate(EventRequest content) {
        rules.validateContent(content);
        if (!events.organizationUnitExists(content.organizationUnitId())) {
            throw new ApiException(400, "INVALID_UNIT", "Đơn vị tổ chức không hợp lệ.",
                    Map.of("organizationUnitId", "Vui lòng chọn đơn vị hợp lệ."));
        }
        if (!events.departmentsExist(content.departmentIds())) {
            throw new ApiException(400, "INVALID_DEPARTMENTS", "Danh sách khoa không hợp lệ.",
                    Map.of("departmentIds", "Có khoa không tồn tại."));
        }
    }

    private ApiException versionConflict() {
        return new ApiException(409, "VERSION_CONFLICT", "Sự kiện đã thay đổi. Vui lòng tải lại trước khi lưu.");
    }
}
