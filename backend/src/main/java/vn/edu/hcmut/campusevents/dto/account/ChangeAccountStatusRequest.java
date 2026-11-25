package vn.edu.hcmut.campusevents.dto.account;

import jakarta.validation.constraints.*;

public record ChangeAccountStatusRequest(
        @NotNull @Pattern(regexp = "ACTIVE|LOCKED") String status,
        @Min(1) int version,
        @NotBlank @Size(max = 1000) String reason) {}
