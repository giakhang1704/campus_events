package vn.edu.hcmut.campusevents.dto.registration;

import java.time.OffsetDateTime;

public record ParticipantResponse(
        long id,
        long studentId,
        String fullName,
        String email,
        String studentCode,
        long departmentId,
        int studyYear,
        String status,
        OffsetDateTime waitlistedAt,
        OffsetDateTime registeredAt,
        OffsetDateTime cancelledAt,
        int version,
        Integer queuePosition) {}
