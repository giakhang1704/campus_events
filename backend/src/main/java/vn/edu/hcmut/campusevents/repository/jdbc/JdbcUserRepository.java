package vn.edu.hcmut.campusevents.repository.jdbc;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.model.User;
import vn.edu.hcmut.campusevents.repository.IUserRepository;
import vn.edu.hcmut.campusevents.repository.jdbc.mapper.UserRowMapper;

import java.util.List;
import java.util.Optional;

@Repository
public class JdbcUserRepository implements IUserRepository {
    private static final String SELECT =
            "SELECT u.*,p.student_code,p.department_id,p.study_year FROM campus.users u LEFT JOIN"
                    + " campus.student_profiles p ON p.user_id=u.id ";
    private static final UserRowMapper MAPPER = new UserRowMapper();
    private final JdbcTemplate jdbc;

    public JdbcUserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public User find(long id) {
        return jdbc.query(SELECT + "WHERE u.id=?", MAPPER, id).stream()
                .findFirst()
                .orElseThrow(
                        () -> new ApiException(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản."));
    }

    @Override
    public Optional<User> email(String email) {
        return jdbc.query(SELECT + "WHERE u.email=?", MAPPER, email).stream().findFirst();
    }

    @Override
    public List<User> list(String query, String role, String status, int page, int size) {
        String pattern = "%" + query.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        return jdbc.query(
                SELECT
                        + """
WHERE (u.full_name ILIKE ? ESCAPE '!' OR u.email ILIKE ? ESCAPE '!' OR p.student_code ILIKE ? ESCAPE '!')
AND (?='' OR u.role=?) AND (?='' OR u.status=?) ORDER BY u.id LIMIT ? OFFSET ?
""",
                MAPPER,
                pattern,
                pattern,
                pattern,
                role,
                role,
                status,
                status,
                size + 1,
                page * size);
    }

    @Override
    public void adminLock() {
        // Serialize administrative changes, including checks on the acting Admin.
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(3011001)", (rs, row) -> true);
    }

    @Override
    public void lock(long id) {
        jdbc.queryForObject("SELECT id FROM campus.users WHERE id=? FOR UPDATE", Long.class, id);
    }

    @Override
    public int countActiveAdminsExcluding(long id) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM campus.users WHERE role='ADMIN' AND status='ACTIVE' AND"
                        + " id<>?",
                Integer.class,
                id);
    }

    @Override
    public long insert(
            String name,
            String email,
            String hash,
            String role,
            Long unit,
            String status,
            boolean mustChangePassword) {
        return jdbc.queryForObject(
                """
INSERT INTO campus.users(full_name,email,password_hash,role,organization_unit_id,status,must_change_password)
VALUES(?,?,?,?,?,?,?) RETURNING id
""",
                Long.class,
                name,
                email,
                hash,
                role,
                unit,
                status,
                mustChangePassword);
    }

    @Override
    public void insertStudentProfile(long id, String code, long departmentId, int year) {
        jdbc.update(
                "INSERT INTO campus.student_profiles(user_id,student_code,department_id,study_year)"
                        + " VALUES(?,?,?,?)",
                id,
                code,
                departmentId,
                year);
    }

    @Override
    public void updateStatus(long id, String status) {
        jdbc.update(
                "UPDATE campus.users SET"
                    + " status=?,version=version+1,auth_version=auth_version+1,updated_at=clock_timestamp()"
                    + " WHERE id=?",
                status,
                id);
    }

    @Override
    public void updatePassword(long id, String hash) {
        jdbc.update(
                "UPDATE campus.users SET"
                    + " password_hash=?,must_change_password=false,auth_version=auth_version+1,version=version+1,updated_at=clock_timestamp()"
                    + " WHERE id=?",
                hash,
                id);
    }
}
