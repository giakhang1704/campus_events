package vn.edu.hcmut.campusevents.dto.attendance;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record OpenAttendanceRequest(@Min(1) @Max(30) int durationMinutes) {}
