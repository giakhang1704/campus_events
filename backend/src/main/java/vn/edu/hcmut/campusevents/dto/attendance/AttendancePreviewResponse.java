package vn.edu.hcmut.campusevents.dto.attendance;

import java.time.OffsetDateTime;

public record AttendancePreviewResponse(
        long eventId,
        int eventVersion,
        String title,
        String location,
        OffsetDateTime startsAt,
        OffsetDateTime endsAt,
        long sessionId,
        OffsetDateTime expiresAt,
        long registrationId,
        int registrationVersion,
        int attendanceVersion,
        boolean alreadyPresent) {}
