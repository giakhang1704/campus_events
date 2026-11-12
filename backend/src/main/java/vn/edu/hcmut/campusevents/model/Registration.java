package vn.edu.hcmut.campusevents.model;

import java.time.OffsetDateTime;

public record Registration(
        long id,
        long eventId,
        long studentId,
        String status,
        OffsetDateTime waitlistedAt,
        OffsetDateTime registeredAt,
        OffsetDateTime cancelledAt,
        int version) {}
