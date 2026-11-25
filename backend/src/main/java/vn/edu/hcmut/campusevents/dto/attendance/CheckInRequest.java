package vn.edu.hcmut.campusevents.dto.attendance;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

public record CheckInRequest(
        @Positive long sessionId,
        @NotNull @Pattern(regexp = "[A-Za-z0-9_-]{43}") String token,
        @Positive int eventVersion,
        @Positive int registrationVersion,
        @NotNull @Min(0) Integer attendanceVersion) {}
