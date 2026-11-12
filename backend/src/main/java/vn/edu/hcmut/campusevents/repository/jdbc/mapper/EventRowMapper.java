package vn.edu.hcmut.campusevents.repository.jdbc.mapper;

import org.springframework.jdbc.core.RowMapper;

import vn.edu.hcmut.campusevents.model.Event;
import vn.edu.hcmut.campusevents.model.EventStatus;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;

public class EventRowMapper implements RowMapper<Event> {
    @Override
    public Event mapRow(ResultSet rs, int rowNumber) throws SQLException {
        return new Event(
                rs.getLong("id"),
                rs.getLong("organizer_id"),
                rs.getLong("organization_unit_id"),
                rs.getString("title"),
                rs.getString("description"),
                rs.getString("location"),
                rs.getObject("registration_opens_at", OffsetDateTime.class),
                rs.getObject("registration_closes_at", OffsetDateTime.class),
                rs.getObject("starts_at", OffsetDateTime.class),
                rs.getObject("ends_at", OffsetDateTime.class),
                rs.getInt("capacity"),
                EventStatus.valueOf(rs.getString("status")),
                rs.getObject("published_at", OffsetDateTime.class),
                rs.getInt("version"),
                List.of(),
                List.of());
    }
}
