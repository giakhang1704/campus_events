package vn.edu.hcmut.campusevents.dto.auth;

import jakarta.validation.constraints.*;

public record RegisterRequest(
        @NotBlank @Size(max = 150) String fullName,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @Size(max = 30) String studentCode,
        @NotNull @Positive Long departmentId,
        @NotNull @Min(1) @Max(32767) Integer studyYear) {}
