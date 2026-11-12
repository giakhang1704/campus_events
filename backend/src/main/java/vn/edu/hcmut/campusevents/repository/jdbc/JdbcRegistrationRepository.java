package vn.edu.hcmut.campusevents.repository.jdbc;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import vn.edu.hcmut.campusevents.dto.registration.*;
import vn.edu.hcmut.campusevents.model.*;
import vn.edu.hcmut.campusevents.repository.IRegistrationRepository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class JdbcRegistrationRepository implements IRegistrationRepository {
    private final JdbcTemplate jdbc;

    public JdbcRegistrationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final String POSITION =
            """
            CASE WHEN r.status='WAITLISTED' THEN
              (SELECT count(*)::integer FROM campus.registrations q WHERE q.event_id=r.event_id
               AND q.status='WAITLISTED' AND (q.waitlisted_at,q.id)<=(r.waitlisted_at,r.id))
            ELSE NULL END AS queue_position
            """;
    private static final String RESPONSE =
            "SELECT r.*,e.title AS event_title,e.location,e.starts_at,e.ends_at,"
                    + POSITION
                    + " FROM campus.registrations r JOIN campus.events e ON e.id=r.event_id ";

    private Registration map(ResultSet rs, int row) throws SQLException {
        return new Registration(
                rs.getLong("id"),
                rs.getLong("event_id"),
                rs.getLong("student_id"),
                rs.getString("status"),
                rs.getObject("waitlisted_at", OffsetDateTime.class),
                rs.getObject("registered_at", OffsetDateTime.class),
                rs.getObject("cancelled_at", OffsetDateTime.class),
                rs.getInt("version"));
    }

    private RegistrationResponse mapResponse(ResultSet rs, int row) throws SQLException {
        Registration r = map(rs, row);
        return new RegistrationResponse(
                r.id(),
                r.eventId(),
                r.studentId(),
                r.status(),
                r.waitlistedAt(),
                r.registeredAt(),
                r.cancelledAt(),
                r.version(),
                rs.getString("event_title"),
                rs.getString("location"),
                rs.getObject("starts_at", OffsetDateTime.class),
                rs.getObject("ends_at", OffsetDateTime.class),
                (Integer) rs.getObject("queue_position"));
    }

    @Override
    public OffsetDateTime now() {
        return jdbc.queryForObject("SELECT clock_timestamp()", OffsetDateTime.class);
    }

    @Override
    public Optional<Registration> find(long eventId, long studentId) {
        return jdbc
                .query(
                        "SELECT * FROM campus.registrations WHERE event_id=? AND student_id=?",
                        this::map,
                        eventId,
                        studentId)
                .stream()
                .findFirst();
    }

    @Override
    public Registration insert(long eventId, long studentId, String status) {
        return jdbc.queryForObject(
                """
INSERT INTO campus.registrations(event_id,student_id,status,registered_at,waitlisted_at)
VALUES(?,?,?,CASE WHEN ?='REGISTERED' THEN clock_timestamp() ELSE NULL END,
    CASE WHEN ?='WAITLISTED' THEN clock_timestamp() ELSE NULL END) RETURNING *
""",
                this::map,
                eventId,
                studentId,
                status,
                status,
                status);
    }

    @Override
    public Registration reactivate(Registration before, String status) {
        // The existing BEFORE/AFTER triggers reset attendance and add REREGISTER history.
        return jdbc.queryForObject(
                """
UPDATE campus.registrations SET status=?,cancelled_at=NULL,
    registered_at=CASE WHEN ?='REGISTERED' THEN clock_timestamp() ELSE NULL END,
    waitlisted_at=CASE WHEN ?='WAITLISTED' THEN clock_timestamp() ELSE NULL END,
    version=version+1,updated_at=clock_timestamp() WHERE id=? AND status='CANCELLED' RETURNING *
""",
                this::map,
                status,
                status,
                status,
                before.id());
    }

    @Override
    public Registration cancel(Registration before) {
        return jdbc.queryForObject(
                "UPDATE campus.registrations SET"
                    + " status='CANCELLED',cancelled_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()"
                    + " WHERE id=? RETURNING *",
                this::map,
                before.id());
    }

    @Override
    public Registration promote(Registration before) {
        return jdbc.queryForObject(
                "UPDATE campus.registrations SET"
                    + " status='REGISTERED',registered_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()"
                    + " WHERE id=? AND status='WAITLISTED' RETURNING *",
                this::map,
                before.id());
    }

    @Override
    public List<WaitlistCandidate> waiting(long eventId) {
        return jdbc.query(
                """
SELECT r.*,p.department_id,p.study_year,u.status AS account_status,u.role
FROM campus.registrations r JOIN campus.student_profiles p ON p.user_id=r.student_id
JOIN campus.users u ON u.id=r.student_id
WHERE r.event_id=? AND r.status='WAITLISTED' ORDER BY r.waitlisted_at,r.id FOR UPDATE OF r
""",
                (rs, n) ->
                        new WaitlistCandidate(
                                map(rs, n),
                                rs.getLong("department_id"),
                                rs.getInt("study_year"),
                                rs.getString("account_status"),
                                rs.getString("role")),
                eventId);
    }

    @Override
    public void history(
            Registration r, Long actor, String action, String oldStatus, String reason) {
        jdbc.update(
                "INSERT INTO"
                    + " campus.registration_history(registration_id,actor_id,action,old_status,new_status,reason)"
                    + " VALUES(?,?,?,?,?,?)",
                r.id(),
                actor,
                action,
                oldStatus,
                r.status(),
                reason);
    }

    @Override
    public void recordSkip(Registration r, int eventVersion) {
        String reason =
                "Not eligible for event version "
                        + eventVersion
                        + ", registration version "
                        + r.version();
        jdbc.update(
                """
INSERT INTO campus.registration_history(registration_id,action,old_status,new_status,reason)
SELECT ?,'SKIP','WAITLISTED','WAITLISTED',? WHERE NOT EXISTS
    (SELECT 1 FROM campus.registration_history WHERE registration_id=? AND action='SKIP' AND reason=?)
""",
                r.id(),
                reason,
                r.id(),
                reason);
    }

    @Override
    public RegistrationResponse response(long eventId, long studentId) {
        return jdbc.queryForObject(
                RESPONSE + "WHERE r.event_id=? AND r.student_id=?",
                this::mapResponse,
                eventId,
                studentId);
    }

    @Override
    public List<RegistrationResponse> listMine(long studentId, String status, int page, int size) {
        return jdbc.query(
                RESPONSE
                        + "WHERE r.student_id=? AND (?='' OR r.status=?) ORDER BY r.updated_at"
                        + " DESC,r.id DESC LIMIT ? OFFSET ?",
                this::mapResponse,
                studentId,
                status,
                status,
                size + 1,
                page * size);
    }

    @Override
    public List<ParticipantResponse> listParticipants(
            long eventId, String status, int page, int size) {
        return jdbc.query(
                "SELECT r.*,u.full_name,u.email,p.student_code,p.department_id,p.study_year,"
                        + POSITION
                        + """
FROM campus.registrations r JOIN campus.users u ON u.id=r.student_id
JOIN campus.student_profiles p ON p.user_id=r.student_id
WHERE r.event_id=? AND (?='' OR r.status=?)
ORDER BY CASE r.status WHEN 'REGISTERED' THEN 0 WHEN 'WAITLISTED' THEN 1 ELSE 2 END,
    r.waitlisted_at NULLS LAST,r.id LIMIT ? OFFSET ?
""",
                (rs, n) ->
                        new ParticipantResponse(
                                rs.getLong("id"),
                                rs.getLong("student_id"),
                                rs.getString("full_name"),
                                rs.getString("email"),
                                rs.getString("student_code"),
                                rs.getLong("department_id"),
                                rs.getInt("study_year"),
                                rs.getString("status"),
                                rs.getObject("waitlisted_at", OffsetDateTime.class),
                                rs.getObject("registered_at", OffsetDateTime.class),
                                rs.getObject("cancelled_at", OffsetDateTime.class),
                                rs.getInt("version"),
                                (Integer) rs.getObject("queue_position")),
                eventId,
                status,
                status,
                size + 1,
                page * size);
    }

    @Override
    public List<Registration> activeRegistrations(long eventId) {
        return jdbc.query(
                "SELECT * FROM campus.registrations WHERE event_id=? AND status IN"
                        + " ('REGISTERED','WAITLISTED') ORDER BY id",
                this::map,
                eventId);
    }

    @Override
    public String recipientEmail(long id) {
        return jdbc.queryForObject("SELECT email FROM campus.users WHERE id=?", String.class, id);
    }
}
