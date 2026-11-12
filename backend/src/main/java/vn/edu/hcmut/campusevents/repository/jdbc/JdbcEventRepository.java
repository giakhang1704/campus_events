package vn.edu.hcmut.campusevents.repository.jdbc;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import vn.edu.hcmut.campusevents.model.Event;
import vn.edu.hcmut.campusevents.model.EventContent;
import vn.edu.hcmut.campusevents.repository.IEventRepository;
import vn.edu.hcmut.campusevents.repository.jdbc.mapper.EventRowMapper;

import java.util.*;

/** All event SQL lives here. Writes participate in the service transaction. */
@Repository
public class JdbcEventRepository implements IEventRepository {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;

    public JdbcEventRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.named = new NamedParameterJdbcTemplate(jdbc);
    }

    public Optional<Event> find(long id, boolean forUpdate) {
        var rows =
                jdbc.query(
                        "SELECT * FROM campus.events WHERE id=?" + (forUpdate ? " FOR UPDATE" : ""),
                        new EventRowMapper(),
                        id);
        return withRestrictions(rows).stream().findFirst();
    }

    public Optional<Event> findPublished(long id) {
        var rows =
                jdbc.query(
                        "SELECT * FROM campus.events WHERE id=? AND status='PUBLISHED'",
                        new EventRowMapper(),
                        id);
        return withRestrictions(rows).stream().findFirst();
    }

    public List<Event> listPublished(String query, int page, int size) {
        // Treat LIKE metacharacters as literal text. Values remain bound SQL parameters.
        String pattern = "%" + query.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        var rows =
                jdbc.query(
                        """
                        SELECT * FROM campus.events
                        WHERE status='PUBLISHED' AND title ILIKE ? ESCAPE '!'
                        ORDER BY starts_at ASC,id ASC LIMIT ? OFFSET ?
                        """,
                        new EventRowMapper(),
                        pattern,
                        size + 1,
                        page * size);
        return withRestrictions(rows);
    }

    public List<Event> listOwned(long organizerId, int page, int size) {
        var rows =
                jdbc.query(
                        "SELECT * FROM campus.events WHERE organizer_id=? ORDER BY id DESC LIMIT ?"
                                + " OFFSET ?",
                        new EventRowMapper(),
                        organizerId,
                        size + 1,
                        page * size);
        return withRestrictions(rows);
    }

    public long insert(long organizerId, EventContent content) {
        Long id =
                jdbc.queryForObject(
                        """
INSERT INTO campus.events(organizer_id,organization_unit_id,title,description,location,
    registration_opens_at,registration_closes_at,starts_at,ends_at,capacity)
VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id
""",
                        Long.class,
                        organizerId,
                        content.organizationUnitId(),
                        content.title().trim(),
                        content.description().trim(),
                        content.location().trim(),
                        content.registrationOpensAt(),
                        content.registrationClosesAt(),
                        content.startsAt(),
                        content.endsAt(),
                        content.capacity());
        replaceRestrictions(id, content);
        return id;
    }

    public boolean update(Event before, EventContent content) {
        int changed =
                jdbc.update(
                        """
UPDATE campus.events SET organization_unit_id=?,title=?,description=?,location=?,
    registration_opens_at=?,registration_closes_at=?,starts_at=?,ends_at=?,capacity=?,
    version=version+1,updated_at=clock_timestamp()
WHERE id=? AND organizer_id=? AND version=?
""",
                        content.organizationUnitId(),
                        content.title().trim(),
                        content.description().trim(),
                        content.location().trim(),
                        content.registrationOpensAt(),
                        content.registrationClosesAt(),
                        content.startsAt(),
                        content.endsAt(),
                        content.capacity(),
                        before.id(),
                        before.organizerId(),
                        before.version());
        if (changed == 1) replaceRestrictions(before.id(), content);
        return changed == 1;
    }

    public boolean publish(Event before) {
        return jdbc.update(
                        """
                        UPDATE campus.events SET status='PUBLISHED',published_at=clock_timestamp(),
                            version=version+1,updated_at=clock_timestamp()
                        WHERE id=? AND organizer_id=? AND version=? AND status='DRAFT'
                        """,
                        before.id(),
                        before.organizerId(),
                        before.version())
                == 1;
    }

    public int countParticipants(long eventId, String status) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM campus.registrations WHERE event_id=? AND status=?",
                Integer.class,
                eventId,
                status);
    }

    private void replaceRestrictions(long eventId, EventContent content) {
        jdbc.update("DELETE FROM campus.event_departments WHERE event_id=?", eventId);
        jdbc.update("DELETE FROM campus.event_study_years WHERE event_id=?", eventId);
        jdbc.batchUpdate(
                "INSERT INTO campus.event_departments(event_id,department_id) VALUES(?,?)",
                content.departmentIds().stream().map(id -> new Object[] {eventId, id}).toList());
        jdbc.batchUpdate(
                "INSERT INTO campus.event_study_years(event_id,study_year) VALUES(?,?)",
                content.studyYears().stream().map(year -> new Object[] {eventId, year}).toList());
    }

    // Two batched queries avoid fetching eligibility separately for every list row.
    private List<Event> withRestrictions(List<Event> rows) {
        if (rows.isEmpty()) return rows;
        var params = Map.of("ids", rows.stream().map(Event::id).toList());
        Map<Long, List<Long>> departments = new HashMap<>();
        Map<Long, List<Integer>> years = new HashMap<>();
        named.query(
                "SELECT event_id,department_id FROM campus.event_departments WHERE event_id IN"
                        + " (:ids) ORDER BY department_id",
                params,
                (org.springframework.jdbc.core.RowCallbackHandler)
                        rs ->
                                departments
                                        .computeIfAbsent(
                                                rs.getLong("event_id"), key -> new ArrayList<>())
                                        .add(rs.getLong("department_id")));
        named.query(
                "SELECT event_id,study_year FROM campus.event_study_years WHERE event_id IN (:ids)"
                        + " ORDER BY study_year",
                params,
                (org.springframework.jdbc.core.RowCallbackHandler)
                        rs ->
                                years.computeIfAbsent(
                                                rs.getLong("event_id"), key -> new ArrayList<>())
                                        .add(rs.getInt("study_year")));
        return rows.stream()
                .map(
                        event ->
                                event.withRestrictions(
                                        departments.getOrDefault(event.id(), List.of()),
                                        years.getOrDefault(event.id(), List.of())))
                .toList();
    }

    @Override
    public boolean hasUnfinishedEvents(long organizerId) {
        return jdbc.queryForObject(
                        "SELECT count(*) FROM campus.events WHERE organizer_id=? AND"
                                + " (status='DRAFT' OR ends_at>clock_timestamp())",
                        Integer.class,
                        organizerId)
                > 0;
    }
}
