package vn.edu.hcmut.campusevents.dto.event;

import vn.edu.hcmut.campusevents.model.EventStatus;

import java.time.OffsetDateTime;
import java.util.List;

public record EventResponse(
        long id,
        long organizerId,
        long organizationUnitId,
        String title,
        String description,
        String location,
        OffsetDateTime registrationOpensAt,
        OffsetDateTime registrationClosesAt,
        OffsetDateTime startsAt,
        OffsetDateTime endsAt,
        int capacity,
        EventStatus status,
        OffsetDateTime publishedAt,
        int version,
        List<Long> departmentIds,
        List<Integer> studyYears) {}
