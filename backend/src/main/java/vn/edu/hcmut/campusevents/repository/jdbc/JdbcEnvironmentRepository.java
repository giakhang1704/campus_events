package vn.edu.hcmut.campusevents.repository.jdbc;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import vn.edu.hcmut.campusevents.repository.IEnvironmentRepository;

@Repository
public class JdbcEnvironmentRepository implements IEnvironmentRepository {
    private final JdbcTemplate jdbc;

    public JdbcEnvironmentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public int countTables() {
        return jdbc.queryForObject(
                "SELECT count(*)::integer FROM information_schema.tables WHERE"
                        + " table_schema='campus' AND table_type='BASE TABLE'",
                Integer.class);
    }

    @Override
    public void checkEventsReadable() {
        jdbc.queryForObject("SELECT count(*) FROM campus.events", Long.class);
    }
}
