package vn.edu.hcmut.campusevents.dto.report;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record EventReportResponse(
        long eventId,
        String title,
        OffsetDateTime generatedAt,
        OffsetDateTime endsAt,
        boolean hasEnded,
        long registeredCount,
        long waitingCount,
        long cancelledCount,
        long presentCount,
        long notRecordedCount,
        Long absentCount,
        BigDecimal attendanceRate) {}
