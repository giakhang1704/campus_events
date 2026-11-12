package vn.edu.hcmut.campusevents.repository.jdbc;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import vn.edu.hcmut.campusevents.repository.ISeedRepository;

@Repository
public class JdbcSeedRepository implements ISeedRepository {
    private final JdbcTemplate jdbc;

    public JdbcSeedRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public long ensureDevelopmentUnit() {
        jdbc.update(
                "INSERT INTO campus.organization_units(name) VALUES('Đơn vị thử nghiệm I1') ON"
                        + " CONFLICT(name) DO NOTHING");
        return jdbc.queryForObject(
                "SELECT id FROM campus.organization_units WHERE name='Đơn vị thử nghiệm I1'",
                Long.class);
    }

    @Override
    public long developmentDepartmentId() {
        return jdbc.queryForObject(
                "SELECT id FROM campus.departments WHERE code='CSE'", Long.class);
    }

    @Override
    public void ensureStudentProfile(long userId, String code, long departmentId) {
        jdbc.update(
                "INSERT INTO campus.student_profiles(user_id,student_code,department_id,study_year)"
                        + " VALUES(?,?,?,2) ON CONFLICT(user_id) DO NOTHING",
                userId,
                code,
                departmentId);
    }

    @Override
    public void ensureEvent(long organizerId, long unitId, String status) {
        String title = "I1 - " + status;
        jdbc.update(
                """
INSERT INTO campus.events(organizer_id,organization_unit_id,title,description,location,
    registration_opens_at,registration_closes_at,starts_at,ends_at,capacity,status,published_at)
SELECT ?,?,?,?,'Phòng thử nghiệm',clock_timestamp()-interval '1 day',
    clock_timestamp()+interval '6 days',clock_timestamp()+interval '7 days',
    clock_timestamp()+interval '7 days 2 hours',30,?,CASE WHEN ?='PUBLISHED' THEN clock_timestamp() ELSE NULL END
WHERE NOT EXISTS(SELECT 1 FROM campus.events WHERE title=? AND organizer_id=?)
""",
                organizerId,
                unitId,
                title,
                "Dữ liệu giả lập I1",
                status,
                status,
                title,
                organizerId);
    }
}
