package vn.edu.hcmut.campusevents.model;

import java.time.OffsetDateTime;

public record OutboxMessage(
        long id,
        long registrationId,
        String recipient,
        String kind,
        String dedupeKey,
        String payload,
        int attempts,
        OffsetDateTime leaseUntil) {}
