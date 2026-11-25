package vn.edu.hcmut.campusevents.support;

import vn.edu.hcmut.campusevents.model.Event;
import vn.edu.hcmut.campusevents.model.EventContent;
import vn.edu.hcmut.campusevents.model.EventStatus;

import java.time.OffsetDateTime;
import java.util.List;

public final class EventFixtures {
    private EventFixtures() {}

    public static EventContent content() {
        return new EventContent(
                "Workshop",
                "Description",
                "Room A",
                1L,
                OffsetDateTime.parse("2026-11-10T08:00:00+07:00"),
                OffsetDateTime.parse("2026-11-11T08:00:00+07:00"),
                OffsetDateTime.parse("2026-11-11T08:00:00+07:00"),
                OffsetDateTime.parse("2026-11-11T10:00:00+07:00"),
                20,
                List.of(1L, 2L),
                List.of(1, 2),
                1);
    }

    public static Event event(long owner, EventStatus status) {
        var c = content();
        return new Event(
                10,
                owner,
                c.organizationUnitId(),
                c.title(),
                c.description(),
                c.location(),
                c.registrationOpensAt(),
                c.registrationClosesAt(),
                c.startsAt(),
                c.endsAt(),
                c.capacity(),
                status,
                status == EventStatus.PUBLISHED ? c.registrationOpensAt() : null,
                1,
                c.departmentIds(),
                c.studyYears());
    }
}
