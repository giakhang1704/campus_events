package vn.edu.hcmut.campusevents.mapper;

import vn.edu.hcmut.campusevents.dto.account.AccountResponse;
import vn.edu.hcmut.campusevents.model.User;

public final class AccountMapper {
    private AccountMapper() {}

    public static AccountResponse toResponse(User user) {
        return new AccountResponse(
                user.id(),
                user.fullName(),
                user.email(),
                user.role(),
                user.status(),
                user.mustChangePassword(),
                user.version(),
                user.organizationUnitId(),
                user.studentCode(),
                user.departmentId(),
                user.studyYear());
    }
}
