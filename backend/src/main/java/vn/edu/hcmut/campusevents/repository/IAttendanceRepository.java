package vn.edu.hcmut.campusevents.repository;

import vn.edu.hcmut.campusevents.dto.attendance.AttendanceHistoryResponse;
import vn.edu.hcmut.campusevents.model.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface IAttendanceRepository {
    OffsetDateTime now();

    Optional<AttendanceSession> openSession(long eventId);

    Optional<AttendanceSession> session(long eventId, long sessionId);

    AttendanceSession createSession(
            long eventId,
            long actorId,
            OffsetDateTime expiresAt,
            String tokenHash,
            String tokenCiphertext);

    AttendanceSession close(AttendanceSession session, long actorId);

    Optional<Registration> registration(long eventId, long registrationId);

    Optional<Attendance> attendance(long registrationId);

    Attendance save(
            Registration registration,
            Attendance before,
            String result,
            String method,
            Long sessionId,
            long actorId,
            String reason);

    void history(Attendance before, Attendance after, long actorId, String reason);

    List<AttendanceHistoryResponse> history(long registrationId, int page, int size);
}
