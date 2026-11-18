package vn.edu.hcmut.campusevents.dto.attendance;

import jakarta.validation.constraints.*;

public record ManualAttendanceRequest(
        @NotNull @Pattern(regexp = "PRESENT|NOT_RECORDED") String result,
        @Min(0) int version,
        @Positive int registrationVersion,
        @NotBlank @Size(max = 500) String reason) {}
