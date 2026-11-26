package vn.edu.hcmut.campusevents.mapper;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vn.edu.hcmut.campusevents.model.OutboxMessage;
import java.time.OffsetDateTime;
import static org.junit.jupiter.api.Assertions.*;

class EmailTemplateTest {
    private final EmailTemplate template = new EmailTemplate("https://bk-events.vercel.app");
    private final ObjectMapper json = new ObjectMapper();
    private com.fasterxml.jackson.databind.node.ObjectNode payload() {
        return json.createObjectNode().put("eventId", 6).put("eventTitle", "Workshop <script>alert('x')</script>")
                .put("location", "A & B").put("startsAt", "2026-11-25T02:00:00Z")
                .put("endsAt", "2026-11-25T04:00:00Z");
    }
    private OutboxMessage message(String kind) {
        return new OutboxMessage(1, 42, "student@example.test", kind, "test", "{}", 1, OffsetDateTime.now());
    }
    @Test void confirmationIsEscapedReadableInVietnamTimeAndHasHtmlAndTextLinks() {
        var content = template.render(message("REGISTRATION_CONFIRMED"), payload());
        assertTrue(content.html().contains("&lt;script&gt;"));
        assertFalse(content.html().contains("<script>"));
        assertFalse(content.html().contains("<pre>"));
        assertTrue(content.html().contains("Arial"));
        assertTrue(content.text().contains("09:00"));
        assertTrue(content.text().contains("25/11/2026"));
        assertTrue(content.text().contains("#42"));
        assertTrue(content.html().contains("https://bk-events.vercel.app/events/6"));
        assertTrue(content.text().contains("https://bk-events.vercel.app/events/6"));
    }
    @Test void changeEmailPreservesWaitingStatusAndShowsPreviousInformation() {
        var p = payload().put("registrationStatus", "WAITLISTED").put("previousLocation", "Old room")
                .put("previousStartsAt", "2026-11-24T02:00:00Z").put("previousEndsAt", "2026-11-24T04:00:00Z");
        var content = template.render(message("EVENT_CHANGED"), p);
        assertTrue(content.html().contains("Đang trong danh sách chờ"));
        assertTrue(content.text().contains("Old room"));
        assertTrue(content.text().contains("24/11/2026"));
        assertFalse(content.text().contains("Bạn đã có chỗ tham gia chính thức"));
    }
    @Test void legacyPayloadStillWorksAndPromotionHasItsOwnHeading() {
        var p = payload(); p.remove("eventId");
        var content = template.render(message("WAITLIST_PROMOTED"), p);
        assertTrue(content.text().contains("https://bk-events.vercel.app/my-events"));
        assertTrue(content.subject().contains("Bạn đã có suất tham gia"));
        assertThrows(IllegalArgumentException.class, () -> new EmailTemplate("javascript:alert(1)"));
        assertThrows(IllegalArgumentException.class, () -> new EmailTemplate("https://example.com/\"bad"));
    }

    @Test void exportPreviewSamples() throws Exception {
        var p = payload().put("eventTitle", "Workshop: Kỹ năng quản lý dự án phần mềm")
                .put("location", "Hội trường B4, Trường Đại học Bách khoa – ĐHQG-HCM")
                .put("registrationStatus", "REGISTERED")
                .put("registrationOpensAt", "2026-11-20T01:00:00Z")
                .put("registrationClosesAt", "2026-11-25T01:30:00Z")
                .put("previousLocation", "Phòng 101, tòa B1")
                .put("previousStartsAt", "2026-11-25T01:30:00Z")
                .put("previousEndsAt", "2026-11-25T03:30:00Z");
        var directory = java.nio.file.Path.of("target/email-previews");
        java.nio.file.Files.createDirectories(directory);
        for (String kind : java.util.List.of("REGISTRATION_CONFIRMED", "WAITLIST_PROMOTED", "EVENT_CHANGED")) {
            var content = template.render(message(kind), p);
            java.nio.file.Files.writeString(directory.resolve(kind + ".html"), content.html());
            java.nio.file.Files.writeString(directory.resolve(kind + ".txt"), content.text());
            assertTrue(content.html().contains("Hội trường B4"));
        }
    }
}
