package vn.edu.hcmut.campusevents.repository.jdbc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import vn.edu.hcmut.campusevents.dto.attendance.AttendanceHistoryResponse;
import vn.edu.hcmut.campusevents.model.*;
import vn.edu.hcmut.campusevents.repository.IAttendanceRepository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;

@Repository
public class JdbcAttendanceRepository implements IAttendanceRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public JdbcAttendanceRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    private AttendanceSession mapSession(ResultSet rs, int n) throws SQLException {
        return new AttendanceSession(
                rs.getLong("id"),
                rs.getLong("event_id"),
                rs.getObject("opened_at", OffsetDateTime.class),
                rs.getObject("expires_at", OffsetDateTime.class),
                rs.getObject("closed_at", OffsetDateTime.class),
                rs.getString("token_hash"),
                rs.getString("token_ciphertext"));
    }

    private Attendance map(ResultSet rs, int n) throws SQLException {
        return new Attendance(
                rs.getLong("registration_id"),
                rs.getLong("event_id"),
                rs.getString("result"),
                rs.getString("method"),
                (Long) rs.getObject("session_id"),
                rs.getLong("recorded_by"),
                rs.getObject("recorded_at", OffsetDateTime.class),
                rs.getString("reason"),
                rs.getInt("version"));
    }

    @Override
    public OffsetDateTime now() {
        return jdbc.queryForObject("SELECT clock_timestamp()", OffsetDateTime.class);
    }

    @Override
    public Optional<AttendanceSession> openSession(long eventId) {
        return jdbc
                .query(
                        "SELECT * FROM campus.attendance_sessions WHERE event_id=? AND closed_at IS"
                                + " NULL ORDER BY id DESC LIMIT 1",
                        this::mapSession,
                        eventId)
                .stream()
                .findFirst();
    }

    @Override
    public Optional<AttendanceSession> session(long eventId, long sessionId) {
        return jdbc
                .query(
                        "SELECT * FROM campus.attendance_sessions WHERE event_id=? AND id=?",
                        this::mapSession,
                        eventId,
                        sessionId)
                .stream()
                .findFirst();
    }

    @Override
    public AttendanceSession createSession(
            long eventId, long actorId, OffsetDateTime expiresAt, String hash, String ciphertext) {
        return jdbc.queryForObject(
                "INSERT INTO"
                    + " campus.attendance_sessions(event_id,opened_by,expires_at,token_hash,token_ciphertext)"
                    + " VALUES(?,?,?,?,?) RETURNING *",
                this::mapSession,
                eventId,
                actorId,
                expiresAt,
                hash,
                ciphertext);
    }

    @Override
    public AttendanceSession close(AttendanceSession session, long actorId) {
        return jdbc.queryForObject(
                "UPDATE campus.attendance_sessions SET closed_at=clock_timestamp(),closed_by=?"
                        + " WHERE id=? AND event_id=? RETURNING *",
                this::mapSession,
                actorId,
                session.id(),
                session.eventId());
    }

    @Override
    public Optional<Registration> registration(long eventId, long registrationId) {
        return jdbc
                .query(
                        "SELECT * FROM campus.registrations WHERE event_id=? AND id=?",
                        (rs, n) ->
                                new Registration(
                                        rs.getLong("id"),
                                        rs.getLong("event_id"),
                                        rs.getLong("student_id"),
                                        rs.getString("status"),
                                        rs.getObject("waitlisted_at", OffsetDateTime.class),
                                        rs.getObject("registered_at", OffsetDateTime.class),
                                        rs.getObject("cancelled_at", OffsetDateTime.class),
                                        rs.getInt("version")),
                        eventId,
                        registrationId)
                .stream()
                .findFirst();
    }

    @Override
    public Optional<Attendance> attendance(long registrationId) {
        return jdbc
                .query(
                        "SELECT * FROM campus.attendance WHERE registration_id=?",
                        this::map,
                        registrationId)
                .stream()
                .findFirst();
    }

    @Override
    public Attendance save(
            Registration registration,
            Attendance before,
            String result,
            String method,
            Long sessionId,
            long actorId,
            String reason) {
        if (before == null)
            return jdbc.queryForObject(
                    """
INSERT INTO campus.attendance(registration_id,event_id,result,method,session_id,recorded_by,reason)
VALUES(?,?,?,?,?,?,?) RETURNING *
""",
                    this::map,
                    registration.id(),
                    registration.eventId(),
                    result,
                    method,
                    sessionId,
                    actorId,
                    reason);
        return jdbc.queryForObject(
                """
UPDATE campus.attendance SET result=?,method=?,session_id=?,recorded_by=?,reason=?,
    recorded_at=clock_timestamp(),version=version+1 WHERE registration_id=? AND version=? RETURNING *
""",
                this::map,
                result,
                method,
                sessionId,
                actorId,
                reason,
                registration.id(),
                before.version());
    }

    @Override
    public void history(Attendance before, Attendance after, long actorId, String reason) {
        try {
            jdbc.update(
                    """
INSERT INTO campus.attendance_history(registration_id,actor_id,old_result,new_result,before_data,after_data,reason)
VALUES(?,?,?,?,?::jsonb,?::jsonb,?)
""",
                    after.registrationId(),
                    actorId,
                    before == null ? null : before.result(),
                    after.result(),
                    before == null ? null : json.writeValueAsString(before),
                    json.writeValueAsString(after),
                    reason);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize attendance history", e);
        }
    }

    private JsonNode parse(String value) throws SQLException {
        try {
            return value == null ? null : json.readTree(value);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new SQLException("Invalid attendance snapshot", e);
        }
    }

    @Override
    public List<AttendanceHistoryResponse> history(long registrationId, int page, int size) {
        return jdbc.query(
                "SELECT * FROM campus.attendance_history WHERE registration_id=? ORDER BY id DESC"
                        + " LIMIT ? OFFSET ?",
                (rs, n) ->
                        new AttendanceHistoryResponse(
                                rs.getLong("id"),
                                rs.getLong("registration_id"),
                                rs.getLong("actor_id"),
                                rs.getString("old_result"),
                                rs.getString("new_result"),
                                rs.getString("reason"),
                                rs.getObject("changed_at", OffsetDateTime.class),
                                parse(rs.getString("before_data")),
                                parse(rs.getString("after_data"))),
                registrationId,
                size + 1,
                page * size);
    }
}
