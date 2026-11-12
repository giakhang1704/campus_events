package vn.edu.hcmut.campusevents.model;

import vn.edu.hcmut.campusevents.dto.registration.RegistrationResponse;

public record RegistrationResult(RegistrationResponse registration, boolean changed) {}
