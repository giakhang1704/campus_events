package vn.edu.hcmut.campusevents.model;

import java.time.OffsetDateTime;

/** Internal persistence snapshot; never expose the hash or ciphertext in an API response. */
public record AttendanceSession(
        long id,
        long eventId,
        OffsetDateTime openedAt,
        OffsetDateTime expiresAt,
        OffsetDateTime closedAt,
        String tokenHash,
        String tokenCiphertext) {}
