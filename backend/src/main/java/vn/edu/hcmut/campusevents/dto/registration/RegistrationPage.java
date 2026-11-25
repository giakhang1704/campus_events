package vn.edu.hcmut.campusevents.dto.registration;

import java.util.List;

public record RegistrationPage(
        List<RegistrationResponse> items, int page, int size, boolean hasNext) {}
