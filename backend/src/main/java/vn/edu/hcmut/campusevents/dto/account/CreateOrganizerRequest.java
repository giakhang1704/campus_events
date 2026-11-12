package vn.edu.hcmut.campusevents.dto.account;

import jakarta.validation.constraints.*;

public record CreateOrganizerRequest(
        @NotBlank @Size(max = 150) String fullName,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 72) String temporaryPassword,
        @NotNull @Positive Long organizationUnitId,
        @NotBlank @Size(max = 1000) String reason) {}
