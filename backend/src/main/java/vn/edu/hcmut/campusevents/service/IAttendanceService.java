package vn.edu.hcmut.campusevents.service;

import vn.edu.hcmut.campusevents.dto.attendance.*;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;

public interface IAttendanceService {
    QrSessionResponse open(AuthPrincipal actor, long eventId, int minutes);

    QrSessionResponse current(AuthPrincipal actor, long eventId);

    QrSessionResponse close(AuthPrincipal actor, long eventId, long sessionId);

    String svg(AuthPrincipal actor, long eventId, long sessionId);

    AttendancePreviewResponse preview(
            AuthPrincipal actor, long eventId, AttendanceScanRequest request);

    AttendanceResponse checkIn(AuthPrincipal actor, long eventId, CheckInRequest request);

    AttendanceResponse manual(
            AuthPrincipal actor,
            long eventId,
            long registrationId,
            ManualAttendanceRequest request);

    MyAttendanceResponse mine(AuthPrincipal actor, long eventId);

    AttendanceHistoryPage history(
            AuthPrincipal actor, long eventId, long registrationId, int page, int size);
}
