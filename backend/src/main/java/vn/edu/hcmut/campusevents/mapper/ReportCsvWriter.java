package vn.edu.hcmut.campusevents.mapper;

import org.springframework.stereotype.Component;

import vn.edu.hcmut.campusevents.dto.report.*;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Component
public class ReportCsvWriter {
    public String cell(Object value) {
        String text = value == null ? "" : value.toString();
        int i = 0;
        while (i < text.length()
                && (Character.isWhitespace(text.charAt(i))
                        || Character.isSpaceChar(text.charAt(i))
                        || text.charAt(i) == '\ufeff')) i++;
        if ((!text.isEmpty() && "\t\r\n".indexOf(text.charAt(0)) >= 0)
                || (i < text.length() && "=+-@".indexOf(text.charAt(i)) >= 0)) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }

    private String time(OffsetDateTime value) {
        return value == null
                ? ""
                : value.withOffsetSameInstant(ZoneOffset.ofHours(7))
                        .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    private void row(StringBuilder output, Object... values) {
        for (int i = 0; i < values.length; i++) {
            if (i > 0) output.append(',');
            output.append(cell(values[i]));
        }
        output.append("\r\n");
    }

    public byte[] write(EventReportResponse summary, List<AttendanceRow> rows) {
        var out = new StringBuilder("\ufeff");
        row(
                out,
                "event_id",
                "event_title",
                "generated_at",
                "has_ended",
                "registered_count",
                "present_count",
                "absent_count",
                "attendance_rate_percent",
                "registration_id",
                "student_code",
                "full_name",
                "email",
                "department",
                "study_year",
                "registration_status",
                "attendance_state",
                "recorded_at",
                "method");
        if (rows.isEmpty())
            row(
                    out,
                    summary.eventId(),
                    summary.title(),
                    time(summary.generatedAt()),
                    summary.hasEnded(),
                    summary.registeredCount(),
                    summary.presentCount(),
                    summary.absentCount(),
                    summary.attendanceRate(),
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "");
        for (var r : rows)
            row(
                    out,
                    summary.eventId(),
                    summary.title(),
                    time(summary.generatedAt()),
                    summary.hasEnded(),
                    summary.registeredCount(),
                    summary.presentCount(),
                    summary.absentCount(),
                    summary.attendanceRate(),
                    r.registrationId(),
                    r.studentCode(),
                    r.fullName(),
                    r.email(),
                    r.department(),
                    r.studyYear(),
                    r.registrationStatus(),
                    r.attendanceState(),
                    time(r.recordedAt()),
                    r.method());
        return out.toString().getBytes(StandardCharsets.UTF_8);
    }
}
