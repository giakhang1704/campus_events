package vn.edu.hcmut.campusevents.repository.jdbc.mapper;

import org.springframework.jdbc.core.RowMapper;

import vn.edu.hcmut.campusevents.model.User;

import java.sql.ResultSet;
import java.sql.SQLException;

public class UserRowMapper implements RowMapper<User> {
    @Override
    public User mapRow(ResultSet rs, int rowNumber) throws SQLException {
        return new User(
                rs.getLong("id"),
                rs.getString("full_name"),
                rs.getString("email"),
                rs.getString("role"),
                rs.getString("status"),
                rs.getBoolean("must_change_password"),
                rs.getInt("version"),
                (Long) rs.getObject("organization_unit_id"),
                rs.getString("student_code"),
                (Long) rs.getObject("department_id"),
                rs.getObject("study_year") == null ? null : rs.getInt("study_year"),
                rs.getString("password_hash"),
                rs.getInt("auth_version"));
    }
}
