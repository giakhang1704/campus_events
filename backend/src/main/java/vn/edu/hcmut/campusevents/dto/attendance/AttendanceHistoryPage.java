package vn.edu.hcmut.campusevents.dto.attendance;

import java.util.List;

public record AttendanceHistoryPage(
        List<AttendanceHistoryResponse> items, int page, int size, boolean hasNext) {}
