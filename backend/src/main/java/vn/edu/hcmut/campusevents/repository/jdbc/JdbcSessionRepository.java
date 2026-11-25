package vn.edu.hcmut.campusevents.repository.jdbc;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import vn.edu.hcmut.campusevents.repository.ISessionRepository;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;

import java.util.Optional;

@Repository
public class JdbcSessionRepository implements ISessionRepository {
    private final JdbcTemplate jdbc;

    public JdbcSessionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<AuthPrincipal> authenticate(String tokenHash) {
        return jdbc
                .query(
                        """
SELECT u.id,s.id AS session_id,u.role,u.must_change_password
FROM campus.auth_sessions s JOIN campus.users u ON u.id=s.user_id
WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
    AND u.status='ACTIVE' AND s.auth_version=u.auth_version
""",
                        (rs, row) ->
                                new AuthPrincipal(
                                        rs.getLong("id"),
                                        rs.getLong("session_id"),
                                        rs.getString("role"),
                                        rs.getBoolean("must_change_password")),
                        tokenHash)
                .stream()
                .findFirst();
    }

    @Override
    public boolean hasActiveSession(long userId, long sessionId) {
        return jdbc.queryForObject(
                """
SELECT EXISTS(SELECT 1 FROM campus.auth_sessions s JOIN campus.users u ON u.id=s.user_id
WHERE s.id=? AND s.user_id=? AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
    AND u.status='ACTIVE' AND s.auth_version=u.auth_version)
""",
                Boolean.class,
                sessionId,
                userId);
    }

    @Override
    public void create(long userId, String tokenHash, int authVersion) {
        jdbc.update(
                "INSERT INTO campus.auth_sessions(user_id,token_hash,auth_version,expires_at)"
                        + " VALUES(?,?,?,clock_timestamp()+interval '8 hours')",
                userId,
                tokenHash,
                authVersion);
    }

    @Override
    public void revokeToken(String tokenHash) {
        jdbc.update(
                "UPDATE campus.auth_sessions SET revoked_at=clock_timestamp() WHERE token_hash=?"
                        + " AND revoked_at IS NULL",
                tokenHash);
    }

    @Override
    public void revoke(long sessionId) {
        jdbc.update(
                "UPDATE campus.auth_sessions SET revoked_at=clock_timestamp() WHERE id=? AND"
                        + " revoked_at IS NULL",
                sessionId);
    }

    @Override
    public void revokeAll(long userId) {
        jdbc.update(
                "UPDATE campus.auth_sessions SET revoked_at=clock_timestamp() WHERE user_id=? AND"
                        + " revoked_at IS NULL",
                userId);
    }
}
