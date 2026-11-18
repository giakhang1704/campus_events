package vn.edu.hcmut.campusevents.dto.attendance;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;

public record AttendanceHistoryResponse(
        long id,
        long registrationId,
        long actorId,
        String oldResult,
        String newResult,
        String reason,
        OffsetDateTime changedAt,
        JsonNode beforeData,
        JsonNode afterData) {}
