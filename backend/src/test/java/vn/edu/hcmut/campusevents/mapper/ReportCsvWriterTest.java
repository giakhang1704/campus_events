package vn.edu.hcmut.campusevents.mapper;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

import vn.edu.hcmut.campusevents.dto.report.EventReportResponse;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;

class ReportCsvWriterTest {
    private final ReportCsvWriter writer = new ReportCsvWriter();

    @Test
    void neutralizesFormulaPrefixesEvenAfterWhitespace() {
        for (String value :
                List.of("=SUM(1,2)", "+1", "-1", "@SUM(1)", "  =1", "\t=1", "\ufeff=1", "\ntext"))
            assertTrue(writer.cell(value).startsWith("\"'"));
        assertEquals("\"Tên \"\"Việt\"\", dòng\n2\"", writer.cell("Tên \"Việt\", dòng\n2"));
    }

    @Test
    void zeroRegistrationsStillExportSummaryAndNullRateWithoutNaN() {
        var now = OffsetDateTime.parse("2026-11-18T07:00:00Z");
        var s = new EventReportResponse(1, "Sự kiện", now, now, true, 0, 0, 0, 0, 0, 0L, null);
        String csv = new String(writer.write(s, List.of()), StandardCharsets.UTF_8);
        assertTrue(csv.startsWith("\ufeff"));
        assertTrue(csv.contains("2026-11-18T14:00:00+07:00"));
        assertTrue(csv.contains("Sự kiện"));
        assertFalse(csv.contains("NaN"));
        assertFalse(csv.contains("Infinity"));
        assertEquals(3, csv.split("\r\n", -1).length);
    }
}
