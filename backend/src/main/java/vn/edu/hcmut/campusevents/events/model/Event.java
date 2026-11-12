package vn.edu.hcmut.campusevents.events.model;

import java.time.OffsetDateTime;
import java.util.List;

/** Immutable event snapshot; persistence details and authentication data stay private. */
public record Event(
        long id, long organizerId, long organizationUnitId,
        String title, String description, String location,
        OffsetDateTime registrationOpensAt, OffsetDateTime registrationClosesAt,
        OffsetDateTime startsAt, OffsetDateTime endsAt,
        int capacity, EventStatus status, OffsetDateTime publishedAt, int version,
        List<Long> departmentIds, List<Integer> studyYears) {
    public Event {
        departmentIds = List.copyOf(departmentIds);
        studyYears = List.copyOf(studyYears);
    }

    public Event withRestrictions(List<Long> departments, List<Integer> years) {
        return new Event(id, organizerId, organizationUnitId, title, description, location,
                registrationOpensAt, registrationClosesAt, startsAt, endsAt, capacity,
                status, publishedAt, version, departments, years);
    }

}
