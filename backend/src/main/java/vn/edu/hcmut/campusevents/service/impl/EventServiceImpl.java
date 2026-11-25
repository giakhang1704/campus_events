package vn.edu.hcmut.campusevents.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.hcmut.campusevents.dto.event.EventPageResponse;
import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.mapper.EventMapper;
import vn.edu.hcmut.campusevents.model.Event;
import vn.edu.hcmut.campusevents.model.EventContent;
import vn.edu.hcmut.campusevents.model.EventStatus;
import vn.edu.hcmut.campusevents.repository.ICatalogRepository;
import vn.edu.hcmut.campusevents.repository.IEventRepository;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.service.IAuthService;
import vn.edu.hcmut.campusevents.service.IEmailQueueService;
import vn.edu.hcmut.campusevents.service.IEventService;
import vn.edu.hcmut.campusevents.service.IWaitlistService;
import vn.edu.hcmut.campusevents.validation.EventRules;

import java.util.Map;

@Service
public class EventServiceImpl implements IEventService {
    private final IEventRepository events;
    private final EventRules rules;
    private final ICatalogRepository catalogs;
    private final IAuthService auth;
    private final IWaitlistService waitlist;
    private final IEmailQueueService email;

    public EventServiceImpl(
            IEventRepository events,
            EventRules rules,
            IAuthService auth,
            ICatalogRepository catalogs,
            IWaitlistService waitlist,
            IEmailQueueService email) {
        this.events = events;
        this.rules = rules;
        this.auth = auth;
        this.catalogs = catalogs;
        this.waitlist = waitlist;
        this.email = email;
    }

    // A single snapshot keeps event fields and the two eligibility collections consistent.
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public EventPageResponse listPublished(String query, int page, int size) {
        var rows = events.listPublished(query.strip(), page, size);
        return new EventPageResponse(
                rows.stream().limit(size).map(EventMapper::toResponse).toList(),
                page,
                size,
                rows.size() > size);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Event getPublished(long id) {
        // Do not fall back to an ownership check: this route never reveals drafts.
        return events.findPublished(id)
                .orElseThrow(
                        () ->
                                new ApiException(
                                        404,
                                        "EVENT_NOT_FOUND",
                                        "Không tìm thấy sự kiện đã công bố."));
    }

    @Transactional(readOnly = true)
    public EventPageResponse listOwned(AuthPrincipal actor, int page, int size) {
        var rows = events.listOwned(actor.userId(), page, size);
        return new EventPageResponse(
                rows.stream().limit(size).map(EventMapper::toResponse).toList(),
                page,
                size,
                rows.size() > size);
    }

    @Transactional(readOnly = true)
    public Event getOwned(AuthPrincipal actor, long id) {
        return owned(actor, id, false);
    }

    @Transactional
    public Event create(AuthPrincipal actor, EventContent content) {
        auth.requireActiveOrganizer(actor);
        validate(content);
        return events.find(events.insert(actor.userId(), content), false).orElseThrow();
    }

    @Transactional
    public Event update(AuthPrincipal actor, long id, EventContent content) {
        Event before = owned(actor, id, true);
        auth.requireActiveOrganizer(actor);
        rules.requireVersion(before, content.version());
        validate(content);
        rules.validateParticipantImpact(
                before,
                content,
                events.countParticipants(id, "REGISTERED"),
                events.countParticipants(id, "WAITLISTED"));
        if (!events.update(before, content)) throw versionConflict();
        Event after = events.find(id, false).orElseThrow();
        if (rules.importantChange(before, content)) email.eventChanged(before, after);
        waitlist.promote(after);
        return after;
    }

    @Transactional
    public Event publish(AuthPrincipal actor, long id, int version) {
        Event before = owned(actor, id, true);
        auth.requireActiveOrganizer(actor);
        rules.requireVersion(before, version);
        if (before.status() == EventStatus.PUBLISHED) return before;
        validate(EventContent.from(before));
        if (!events.publish(before)) throw versionConflict();
        return events.find(id, false).orElseThrow();
    }

    private Event owned(AuthPrincipal actor, long id, boolean lock) {
        // A missing event and someone else's event have the same response, including drafts.
        return events.find(id, lock)
                .filter(event -> event.organizerId() == actor.userId())
                .orElseThrow(
                        () ->
                                new ApiException(
                                        404,
                                        "EVENT_NOT_FOUND",
                                        "Không tìm thấy sự kiện trong phạm vi của bạn."));
    }

    private void validate(EventContent content) {
        rules.validateContent(content);
        if (!catalogs.organizationUnitExists(content.organizationUnitId())) {
            throw new ApiException(
                    400,
                    "INVALID_UNIT",
                    "Đơn vị tổ chức không hợp lệ.",
                    Map.of("organizationUnitId", "Vui lòng chọn đơn vị hợp lệ."));
        }
        if (!catalogs.departmentsExist(content.departmentIds())) {
            throw new ApiException(
                    400,
                    "INVALID_DEPARTMENTS",
                    "Danh sách khoa không hợp lệ.",
                    Map.of("departmentIds", "Có khoa không tồn tại."));
        }
    }

    private ApiException versionConflict() {
        return new ApiException(
                409, "VERSION_CONFLICT", "Sự kiện đã thay đổi. Vui lòng tải lại trước khi lưu.");
    }
}
