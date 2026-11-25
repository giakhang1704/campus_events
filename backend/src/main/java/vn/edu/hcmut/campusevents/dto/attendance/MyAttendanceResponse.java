package vn.edu.hcmut.campusevents.dto.attendance;

public record MyAttendanceResponse(
        long eventId,
        Long registrationId,
        String registrationStatus,
        String attendanceState,
        AttendanceResponse attendance) {}
