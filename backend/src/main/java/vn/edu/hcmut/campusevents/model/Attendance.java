package vn.edu.hcmut.campusevents.model;

import java.time.OffsetDateTime;

public record Attendance(
        long registrationId,
        long eventId,
        String result,
        String method,
        Long sessionId,
        long recordedBy,
        OffsetDateTime recordedAt,
        String reason,
        int version) {}
