package vn.edu.hcmut.campusevents.dto.report;

import java.time.OffsetDateTime;

public record AttendanceRow(
        long registrationId,
        int registrationVersion,
        long studentId,
        String studentCode,
        String fullName,
        String email,
        String department,
        int studyYear,
        String registrationStatus,
        String result,
        String attendanceState,
        String method,
        OffsetDateTime recordedAt,
        int attendanceVersion) {}
