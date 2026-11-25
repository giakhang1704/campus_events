package vn.edu.hcmut.campusevents.repository.jdbc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import vn.edu.hcmut.campusevents.dto.account.AccountResponse;
import vn.edu.hcmut.campusevents.repository.IAccountHistoryRepository;

@Repository
public class JdbcAccountHistoryRepository implements IAccountHistoryRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public JdbcAccountHistoryRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    public void record(
            long targetId,
            long actorId,
            String action,
            AccountResponse before,
            AccountResponse after,
            String reason) {
        jdbc.update(
                """
INSERT INTO campus.account_history(target_user_id,actor_id,action,before_data,after_data,reason)
VALUES(?,?,?,?::jsonb,?::jsonb,?)
""",
                targetId,
                actorId,
                action,
                before == null ? null : snapshot(before),
                snapshot(after),
                reason.trim());
    }

    private String snapshot(AccountResponse value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException(error);
        }
    }
}
