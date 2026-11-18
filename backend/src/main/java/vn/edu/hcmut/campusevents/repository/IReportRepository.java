package vn.edu.hcmut.campusevents.repository;

import vn.edu.hcmut.campusevents.dto.report.*;

import java.util.List;

public interface IReportRepository {
    EventReportResponse summary(long eventId);

    List<AttendanceRow> rows(long eventId, boolean ended, String status, int page, int size);
}
