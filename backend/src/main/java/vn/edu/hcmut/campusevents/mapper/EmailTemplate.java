package vn.edu.hcmut.campusevents.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import vn.edu.hcmut.campusevents.exception.EmailDeliveryException;
import vn.edu.hcmut.campusevents.model.OutboxMessage;
import java.net.URI;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Component
public class EmailTemplate {
    public record Content(String subject, String text, String html) {}
    private final String origin;

    public EmailTemplate(@Value("${campus.mail.app-url:https://bk-events.vercel.app}") String appUrl) {
        URI uri = URI.create(appUrl);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                || uri.getQuery() != null || uri.getFragment() != null || !java.util.Set.of("", "/").contains(uri.getPath()))
            throw new IllegalArgumentException("APP_PUBLIC_URL must be an HTTPS origin");
        origin = appUrl.replaceAll("/$", "");
    }

    public Content render(OutboxMessage message, JsonNode p) {
        String heading = switch (message.kind()) {
            case "REGISTRATION_CONFIRMED" -> "Đăng ký sự kiện thành công";
            case "WAITLIST_PROMOTED" -> "Bạn đã có suất tham gia";
            case "EVENT_CHANGED" -> "Cập nhật thông tin sự kiện";
            default -> throw new EmailDeliveryException("UNSUPPORTED_EMAIL_KIND", false);
        };
        String intro = switch (message.kind()) {
            case "REGISTRATION_CONFIRMED" -> "Bạn đã đăng ký thành công sự kiện dưới đây.";
            case "WAITLIST_PROMOTED" -> "Bạn đã được chuyển từ danh sách chờ sang danh sách tham gia chính thức.";
            default -> "Thông tin sự kiện bạn đăng ký đã được cập nhật.";
        };
        String status = switch (p.path("registrationStatus").asText()) {
            case "WAITLISTED" -> "Đang trong danh sách chờ";
            case "REGISTERED" -> "Đăng ký chính thức";
            default -> message.kind().equals("EVENT_CHANGED") ? "Xem trạng thái hiện tại trên BKevent" : "Đăng ký chính thức";
        };
        String title = p.path("eventTitle").asText();
        String link = origin + (p.path("eventId").asLong() > 0 ? "/events/" + p.path("eventId").asLong() : "/my-events");
        StringBuilder rows = new StringBuilder();
        StringBuilder text = new StringBuilder(heading + "\n\nChào bạn,\n" + intro + "\n\n");
        row(rows, text, "Sự kiện", title);
        row(rows, text, "Mã đăng ký", "#" + message.registrationId());
        row(rows, text, "Trạng thái", status);
        row(rows, text, "Địa điểm", p.path("location").asText());
        row(rows, text, "Bắt đầu", time(p.path("startsAt").asText()));
        row(rows, text, "Kết thúc", time(p.path("endsAt").asText()));
        if (message.kind().equals("EVENT_CHANGED")) {
            optionalTime(rows, text, p, "registrationOpensAt", "Mở đăng ký");
            optionalTime(rows, text, p, "registrationClosesAt", "Đóng đăng ký");
        }
        String changes = "";
        if (message.kind().equals("EVENT_CHANGED")) {
            StringBuilder previous = new StringBuilder();
            text.append("\nThông tin trước thay đổi:\n");
            row(previous, text, "Địa điểm trước", p.path("previousLocation").asText());
            optionalTime(previous, text, p, "previousStartsAt", "Bắt đầu trước");
            optionalTime(previous, text, p, "previousEndsAt", "Kết thúc trước");
            optionalTime(previous, text, p, "previousRegistrationOpensAt", "Mở đăng ký trước");
            optionalTime(previous, text, p, "previousRegistrationClosesAt", "Đóng đăng ký trước");
            changes = "<p style='margin:18px 0 8px;font-size:14px'><strong>Thông tin trước thay đổi:</strong></p><p style='margin:0;font-size:14px;line-height:22px'>" + previous + "</p>";
        }
        String note = "Bạn có thể hủy đăng ký trên BKevent trước giờ bắt đầu.";
        text.append("\n").append(note).append("\n\nChi tiết sự kiện: ").append(link)
                .append("\n\nThân mến,\nBKevent\nGiờ Việt Nam (UTC+07:00).\n");
        String html = """
                <!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:24px 18px;background:#ffffff;color:#263445;-webkit-text-size-adjust:100%%;text-size-adjust:100%%">
                <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;overflow-wrap:anywhere">
                <p style="margin:0 0 24px;padding:0 0 14px;border-bottom:2px solid #0753a6;font-size:20px;font-weight:700;color:#0753a6">BKevent</p>
                <p style="margin:0 0 20px;font-size:18px;line-height:26px;font-weight:600;color:#123b68">%s</p>
                <p style="margin:0 0 14px;font-size:14px">Chào bạn,</p>
                <p style="margin:0 0 14px;font-size:14px">%s</p>
                <p style="margin:20px 0;font-size:14px;line-height:26px">%s</p>
                %s
                <p style="margin:14px 0;font-size:14px">%s</p>
                <p style="margin:14px 0;font-size:14px">Chi tiết sự kiện: <a href="%s" style="color:#0753a6;text-decoration:underline">Xem trên BKevent</a></p>
                <p style="margin:20px 0 0;font-size:14px">Thân mến,<br><strong style="color:#0753a6">BKevent</strong></p>
                <p style="margin:18px 0 0;padding-top:12px;border-top:1px solid #e5eaf0;font-size:12px;color:#748194">Giờ Việt Nam (UTC+07:00).</p>
                </div></body></html>
                """.formatted(escape(message.kind().equals("REGISTRATION_CONFIRMED") ? "Xác nhận đăng ký" : heading), escape(intro), rows, changes, escape(note), escape(link));
        return new Content("[BKevent] " + heading + ": " + title, text.toString(), html);
    }

    private static void optionalTime(StringBuilder html, StringBuilder text, JsonNode p, String key, String label) {
        if (!p.path(key).asText().isBlank()) row(html, text, label, time(p.path(key).asText()));
    }

    private static String time(String value) {
        return OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.of("Asia/Ho_Chi_Minh"))
                .format(DateTimeFormatter.ofPattern("HH:mm, dd/MM/yyyy", Locale.forLanguageTag("vi-VN")));
    }

    private static void row(StringBuilder html, StringBuilder text, String label, String value) {
        text.append(label).append(": ").append(value).append('\n');
        if (label.equals("Sự kiện")) {
            html.append("<span style='display:block;margin-bottom:12px;font-size:16px;line-height:24px;font-weight:600;color:#0753a6'>")
                    .append(escape(value)).append("</span>");
        } else {
            html.append("<strong>").append(escape(label)).append(":</strong> ")
                    .append(escape(value)).append("<br>");
        }
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
