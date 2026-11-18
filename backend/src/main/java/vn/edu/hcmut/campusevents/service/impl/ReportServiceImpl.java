package vn.edu.hcmut.campusevents.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

import vn.edu.hcmut.campusevents.dto.report.*;
import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.mapper.ReportCsvWriter;
import vn.edu.hcmut.campusevents.model.EventStatus;
import vn.edu.hcmut.campusevents.repository.*;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.service.IReportService;

@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class ReportServiceImpl implements IReportService {
    private final IReportRepository reports;
    private final IEventRepository events;
    private final ReportCsvWriter writer;

    public ReportServiceImpl(
            IReportRepository reports, IEventRepository events, ReportCsvWriter writer) {
        this.reports = reports;
        this.events = events;
        this.writer = writer;
    }

    private void owned(AuthPrincipal actor, long id) {
        events.find(id, false)
                .filter(
                        e ->
                                e.organizerId() == actor.userId()
                                        && e.status() == EventStatus.PUBLISHED)
                .orElseThrow(
                        () ->
                                new ApiException(
                                        404,
                                        "EVENT_NOT_FOUND",
                                        "Không tìm thấy sự kiện đã công bố trong phạm vi của"
                                                + " bạn."));
    }

    @Override
    public EventReportResponse summary(AuthPrincipal actor, long eventId) {
        owned(actor, eventId);
        return reports.summary(eventId);
    }

    @Override
    public AttendancePage participants(
            AuthPrincipal actor, long eventId, String status, int page, int size) {
        owned(actor, eventId);
        var summary = reports.summary(eventId);
        var rows = reports.rows(eventId, summary.hasEnded(), status, page, size);
        return new AttendancePage(
                summary, rows.stream().limit(size).toList(), page, size, rows.size() > size);
    }

    @Override
    public byte[] csv(AuthPrincipal actor, long eventId, String status) {
        owned(actor, eventId);
        var summary = reports.summary(eventId);
        var rows = reports.rows(eventId, summary.hasEnded(), status, 0, 10000);
        if (rows.size() > 10000)
            throw new ApiException(
                    413,
                    "REPORT_TOO_LARGE",
                    "Bản xuất vượt giới hạn 10.000 dòng. Vui lòng lọc trạng thái đăng ký.");
        return writer.write(summary, rows);
    }
}
