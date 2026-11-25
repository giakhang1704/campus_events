package vn.edu.hcmut.campusevents.dto.report;

import java.util.List;

public record AttendancePage(
        EventReportResponse summary,
        List<AttendanceRow> items,
        int page,
        int size,
        boolean hasNext) {}
