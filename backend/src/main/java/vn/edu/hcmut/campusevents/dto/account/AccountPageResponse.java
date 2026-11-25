package vn.edu.hcmut.campusevents.dto.account;

import java.util.List;

public record AccountPageResponse(
        List<AccountResponse> items, int page, int size, boolean hasNext) {}
