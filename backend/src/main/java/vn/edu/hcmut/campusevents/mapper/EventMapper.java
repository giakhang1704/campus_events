package vn.edu.hcmut.campusevents.mapper;

import vn.edu.hcmut.campusevents.dto.event.EventResponse;
import vn.edu.hcmut.campusevents.model.Event;

public final class EventMapper {
    private EventMapper() {}

    public static EventResponse toResponse(Event event) {
        return new EventResponse(
                event.id(),
                event.organizerId(),
                event.organizationUnitId(),
                event.title(),
                event.description(),
                event.location(),
                event.registrationOpensAt(),
                event.registrationClosesAt(),
                event.startsAt(),
                event.endsAt(),
                event.capacity(),
                event.status(),
                event.publishedAt(),
                event.version(),
                event.departmentIds(),
                event.studyYears());
    }
}
