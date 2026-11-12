package vn.edu.hcmut.campusevents.dto.registration;

import java.time.OffsetDateTime;

public record RegistrationResponse(
        long id,
        long eventId,
        long studentId,
        String status,
        OffsetDateTime waitlistedAt,
        OffsetDateTime registeredAt,
        OffsetDateTime cancelledAt,
        int version,
        String eventTitle,
        String location,
        OffsetDateTime startsAt,
        OffsetDateTime endsAt,
        Integer queuePosition) {}
