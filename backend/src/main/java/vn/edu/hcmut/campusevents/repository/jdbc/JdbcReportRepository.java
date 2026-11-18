package vn.edu.hcmut.campusevents.repository.jdbc;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import vn.edu.hcmut.campusevents.dto.report.*;
import vn.edu.hcmut.campusevents.repository.IReportRepository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public class JdbcReportRepository implements IReportRepository {
    private final JdbcTemplate jdbc;

    public JdbcReportRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public EventReportResponse summary(long eventId) {
        return jdbc.queryForObject(
                "SELECT * FROM campus.event_report WHERE event_id=?",
                (rs, n) ->
                        new EventReportResponse(
                                rs.getLong("event_id"),
                                rs.getString("title"),
                                rs.getObject("generated_at", OffsetDateTime.class),
                                rs.getObject("ends_at", OffsetDateTime.class),
                                rs.getBoolean("has_ended"),
                                rs.getLong("registered_count"),
                                rs.getLong("waitlisted_count"),
                                rs.getLong("cancelled_count"),
                                rs.getLong("present_count"),
                                rs.getLong("registered_count") - rs.getLong("present_count"),
                                (Long) rs.getObject("absent_count"),
                                rs.getBigDecimal("attendance_rate")),
                eventId);
    }

    @Override
    public List<AttendanceRow> rows(
            long eventId, boolean ended, String status, int page, int size) {
        return jdbc.query(
                """
SELECT r.id,r.version AS registration_version,r.student_id,r.status,p.student_code,u.full_name,u.email,d.name AS department,p.study_year,
    coalesce(a.result,'NOT_RECORDED') AS result,a.method,a.recorded_at,coalesce(a.version,0) AS attendance_version,
    CASE WHEN r.status<>'REGISTERED' THEN 'NOT_APPLICABLE'
        WHEN a.result='PRESENT' THEN 'PRESENT' WHEN ? THEN 'ABSENT' ELSE 'NOT_RECORDED' END AS attendance_state
FROM campus.registrations r JOIN campus.student_profiles p ON p.user_id=r.student_id
    JOIN campus.users u ON u.id=r.student_id JOIN campus.departments d ON d.id=p.department_id
    LEFT JOIN campus.attendance a ON a.registration_id=r.id
WHERE r.event_id=? AND (?='' OR r.status=?) ORDER BY r.id LIMIT ? OFFSET ?
""",
                (rs, n) ->
                        new AttendanceRow(
                                rs.getLong("id"),
                                rs.getInt("registration_version"),
                                rs.getLong("student_id"),
                                rs.getString("student_code"),
                                rs.getString("full_name"),
                                rs.getString("email"),
                                rs.getString("department"),
                                rs.getInt("study_year"),
                                rs.getString("status"),
                                rs.getString("result"),
                                rs.getString("attendance_state"),
                                rs.getString("method"),
                                rs.getObject("recorded_at", OffsetDateTime.class),
                                rs.getInt("attendance_version")),
                ended,
                eventId,
                status,
                status,
                size + 1,
                page * size);
    }
}
