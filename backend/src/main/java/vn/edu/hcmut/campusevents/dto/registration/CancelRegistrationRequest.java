package vn.edu.hcmut.campusevents.dto.registration;

import jakarta.validation.constraints.Positive;

public record CancelRegistrationRequest(@Positive int version) {}
