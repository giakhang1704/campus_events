package vn.edu.hcmut.campusevents.dto.attendance;

import vn.edu.hcmut.campusevents.model.Attendance;

import java.time.OffsetDateTime;

public record AttendanceResponse(
        long registrationId,
        long eventId,
        String result,
        String method,
        Long sessionId,
        Long recordedBy,
        OffsetDateTime recordedAt,
        String reason,
        int version) {
    public static AttendanceResponse from(Attendance a) {
        return new AttendanceResponse(
                a.registrationId(),
                a.eventId(),
                a.result(),
                a.method(),
                a.sessionId(),
                a.recordedBy(),
                a.recordedAt(),
                a.reason(),
                a.version());
    }
}
