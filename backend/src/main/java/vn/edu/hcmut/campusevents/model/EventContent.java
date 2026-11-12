package vn.edu.hcmut.campusevents.model;

import java.time.OffsetDateTime;
import java.util.List;

public record EventContent(
        String title,
        String description,
        String location,
        Long organizationUnitId,
        OffsetDateTime registrationOpensAt,
        OffsetDateTime registrationClosesAt,
        OffsetDateTime startsAt,
        OffsetDateTime endsAt,
        Integer capacity,
        List<Long> departmentIds,
        List<Integer> studyYears,
        Integer version) {
    public EventContent {
        departmentIds = List.copyOf(departmentIds);
        studyYears = List.copyOf(studyYears);
    }

    public static EventContent from(Event event) {
        return new EventContent(
                event.title(),
                event.description(),
                event.location(),
                event.organizationUnitId(),
                event.registrationOpensAt(),
                event.registrationClosesAt(),
                event.startsAt(),
                event.endsAt(),
                event.capacity(),
                event.departmentIds(),
                event.studyYears(),
                event.version());
    }
}
