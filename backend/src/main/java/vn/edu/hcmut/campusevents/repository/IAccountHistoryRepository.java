package vn.edu.hcmut.campusevents.repository;

import vn.edu.hcmut.campusevents.dto.account.AccountResponse;

public interface IAccountHistoryRepository {
    void record(
            long targetId,
            long actorId,
            String action,
            AccountResponse before,
            AccountResponse after,
            String reason);
}
