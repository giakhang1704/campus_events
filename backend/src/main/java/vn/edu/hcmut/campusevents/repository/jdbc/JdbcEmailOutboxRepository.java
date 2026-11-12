package vn.edu.hcmut.campusevents.repository.jdbc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import vn.edu.hcmut.campusevents.model.*;
import vn.edu.hcmut.campusevents.repository.IEmailOutboxRepository;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;

@Repository
public class JdbcEmailOutboxRepository implements IEmailOutboxRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public JdbcEmailOutboxRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    public void enqueue(
            Event event,
            Registration r,
            String recipient,
            String kind,
            Map<String, Object> payload) {
        String key =
                kind
                        + ":registration:"
                        + r.id()
                        + ":v"
                        + r.version()
                        + (kind.equals("EVENT_CHANGED") ? ":event-v" + event.version() : "");
        try {
            jdbc.update(
                    """
INSERT INTO campus.email_outbox(event_id,registration_id,recipient_user_id,recipient_email,kind,dedupe_key,payload)
VALUES(?,?,?,?,?,?,?::jsonb) ON CONFLICT(dedupe_key) DO NOTHING
""",
                    event.id(),
                    r.id(),
                    r.studentId(),
                    recipient,
                    kind,
                    key,
                    json.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize email payload", e);
        }
    }

    @Override
    public Optional<OutboxMessage> claim(int maxAttempts) {
        // Recover abandoned leases, including the last allowed attempt.
        jdbc.update(
                "UPDATE campus.email_outbox SET"
                        + " status='FAILED',locked_until=NULL,last_error='LEASE_EXPIRED' WHERE"
                        + " status='PROCESSING' AND locked_until<clock_timestamp() AND attempts>=?",
                maxAttempts);
        return jdbc
                .query(
                        """
UPDATE campus.email_outbox SET status='PROCESSING',attempts=attempts+1,
    locked_until=clock_timestamp()+interval '60 seconds'
WHERE id=(SELECT id FROM campus.email_outbox
    WHERE attempts<? AND ((status IN ('PENDING','FAILED') AND next_attempt_at<=clock_timestamp())
        OR (status='PROCESSING' AND locked_until<clock_timestamp()))
    ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING *
""",
                        (rs, n) ->
                                new OutboxMessage(
                                        rs.getLong("id"),
                                        rs.getLong("registration_id"),
                                        rs.getString("recipient_email"),
                                        rs.getString("kind"),
                                        rs.getString("dedupe_key"),
                                        rs.getString("payload"),
                                        rs.getInt("attempts"),
                                        rs.getObject("locked_until", OffsetDateTime.class)),
                        maxAttempts)
                .stream()
                .findFirst();
    }

    @Override
    public boolean current(OutboxMessage message) {
        return jdbc.queryForObject(
                """
SELECT EXISTS(SELECT 1 FROM campus.email_outbox o JOIN campus.registrations r ON r.id=o.registration_id
    WHERE o.id=? AND r.version=(o.payload->>'registrationVersion')::integer
    AND ((o.kind='EVENT_CHANGED' AND r.status IN ('REGISTERED','WAITLISTED'))
        OR (o.kind IN ('REGISTRATION_CONFIRMED','WAITLIST_PROMOTED') AND r.status='REGISTERED')))
""",
                Boolean.class,
                message.id());
    }

    @Override
    public void sent(OutboxMessage m, String providerId) {
        jdbc.update(
                """
UPDATE campus.email_outbox SET status='SENT',sent_at=clock_timestamp(),locked_until=NULL,last_error=NULL,
    payload=jsonb_set(payload,'{providerMessageId}',to_jsonb(?::text))
WHERE id=? AND status='PROCESSING' AND attempts=? AND locked_until=?
""",
                providerId,
                m.id(),
                m.attempts(),
                m.leaseUntil());
    }

    @Override
    public void failed(OutboxMessage m, String reason, boolean retry) {
        int delay = (int) Math.min(300, 5 * Math.pow(2, Math.min(m.attempts() - 1, 6)));
        jdbc.update(
                """
                UPDATE campus.email_outbox SET status='FAILED',locked_until=NULL,last_error=?,
                    next_attempt_at=CASE WHEN ? THEN clock_timestamp()+(? * interval '1 second')
                        ELSE 'infinity'::timestamptz END
                WHERE id=? AND status='PROCESSING' AND attempts=? AND locked_until=?
                """,
                reason,
                retry,
                delay,
                m.id(),
                m.attempts(),
                m.leaseUntil());
    }
}
