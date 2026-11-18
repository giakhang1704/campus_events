package vn.edu.hcmut.campusevents.dto.attendance;

import java.time.OffsetDateTime;

public record QrSessionResponse(
        long id,
        long eventId,
        OffsetDateTime openedAt,
        OffsetDateTime expiresAt,
        OffsetDateTime closedAt,
        boolean active,
        String qrPayload) {}
