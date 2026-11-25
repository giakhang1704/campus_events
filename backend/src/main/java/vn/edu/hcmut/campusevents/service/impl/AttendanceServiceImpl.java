package vn.edu.hcmut.campusevents.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.qrcode.QRCodeWriter;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

import vn.edu.hcmut.campusevents.dto.attendance.*;
import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.model.*;
import vn.edu.hcmut.campusevents.repository.*;
import vn.edu.hcmut.campusevents.security.*;
import vn.edu.hcmut.campusevents.service.*;
import vn.edu.hcmut.campusevents.validation.AttendanceRules;

import java.util.Map;

@Service
public class AttendanceServiceImpl implements IAttendanceService {
    private final IAttendanceRepository attendance;
    private final IEventRepository events;
    private final IRegistrationRepository registrations;
    private final IAuthService auth;
    private final AttendanceRules rules;
    private final QrTokenCipher cipher;
    private final ObjectMapper json;

    public AttendanceServiceImpl(
            IAttendanceRepository attendance,
            IEventRepository events,
            IRegistrationRepository registrations,
            IAuthService auth,
            AttendanceRules rules,
            QrTokenCipher cipher,
            ObjectMapper json) {
        this.attendance = attendance;
        this.events = events;
        this.registrations = registrations;
        this.auth = auth;
        this.rules = rules;
        this.cipher = cipher;
        this.json = json;
    }

    private Event event(long eventId, boolean lock) {
        return events.find(eventId, lock)
                .filter(e -> e.status() == EventStatus.PUBLISHED)
                .orElseThrow(
                        () ->
                                new ApiException(
                                        404,
                                        "EVENT_NOT_FOUND",
                                        "Không tìm thấy sự kiện đã công bố."));
    }

    private Event owned(AuthPrincipal actor, long eventId, boolean lock) {
        Event event = event(eventId, lock);
        if (event.organizerId() != actor.userId())
            throw new ApiException(
                    404, "EVENT_NOT_FOUND", "Không tìm thấy sự kiện trong phạm vi của bạn.");
        return event;
    }

    private AttendanceSession session(long eventId, long id) {
        return attendance
                .session(eventId, id)
                .orElseThrow(
                        () ->
                                new ApiException(
                                        404,
                                        "QR_SESSION_NOT_FOUND",
                                        "Không tìm thấy phiên QR của sự kiện."));
    }

    private Registration registration(long eventId, long registrationId) {
        return attendance
                .registration(eventId, registrationId)
                .orElseThrow(
                        () ->
                                new ApiException(
                                        404,
                                        "REGISTRATION_NOT_FOUND",
                                        "Không tìm thấy đăng ký của sự kiện."));
    }

    private QrSessionResponse response(Event event, AttendanceSession session) {
        boolean active = rules.active(event, session, attendance.now());
        String payload = null;
        if (active) {
            try {
                payload =
                        json.writeValueAsString(
                                Map.of(
                                        "type",
                                        "BKeventCheckIn",
                                        "eventId",
                                        event.id(),
                                        "sessionId",
                                        session.id(),
                                        "token",
                                        cipher.decrypt(event.id(), session.tokenCiphertext())));
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                throw new IllegalStateException("Cannot encode QR payload", e);
            }
        }
        return new QrSessionResponse(
                session.id(),
                event.id(),
                session.openedAt(),
                session.expiresAt(),
                session.closedAt(),
                active,
                payload);
    }

    @Override
    @Transactional
    public QrSessionResponse open(AuthPrincipal actor, long eventId, int minutes) {
        Event event = owned(actor, eventId, true);
        auth.requireActiveOrganizer(actor);
        var now = attendance.now();
        rules.requireWindow(event, now);
        if (minutes < 1 || minutes > 30)
            throw new ApiException(400, "INVALID_DURATION", "Phiên QR kéo dài từ 1 đến 30 phút.");
        var existing = attendance.openSession(eventId);
        if (existing.isPresent() && rules.active(event, existing.get(), now))
            return response(event, existing.get());
        if (existing.isPresent()) attendance.close(existing.get(), actor.userId());
        var expires = now.plusMinutes(minutes);
        if (expires.isAfter(event.endsAt())) expires = event.endsAt();
        String token = cipher.generate();
        var session =
                attendance.createSession(
                        eventId,
                        actor.userId(),
                        expires,
                        cipher.hash(token),
                        cipher.encrypt(eventId, token));
        return response(event, session);
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public QrSessionResponse current(AuthPrincipal actor, long eventId) {
        Event event = owned(actor, eventId, false);
        return attendance.openSession(eventId).map(s -> response(event, s)).orElse(null);
    }

    @Override
    @Transactional
    public QrSessionResponse close(AuthPrincipal actor, long eventId, long sessionId) {
        Event event = owned(actor, eventId, true);
        auth.requireActiveOrganizer(actor);
        var session = session(eventId, sessionId);
        if (session.closedAt() == null) session = attendance.close(session, actor.userId());
        return response(event, session);
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public String svg(AuthPrincipal actor, long eventId, long sessionId) {
        var response = response(owned(actor, eventId, false), session(eventId, sessionId));
        if (!response.active())
            throw new ApiException(
                    409, "QR_SESSION_INVALID", "Phiên QR đã đóng hoặc hết hiệu lực.");
        try {
            var matrix =
                    new QRCodeWriter()
                            .encode(
                                    response.qrPayload(),
                                    BarcodeFormat.QR_CODE,
                                    0,
                                    0,
                                    Map.of(
                                            EncodeHintType.CHARACTER_SET,
                                            "UTF-8",
                                            EncodeHintType.MARGIN,
                                            4));
            int size = matrix.getWidth();
            var path = new StringBuilder();
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                    if (matrix.get(x, y))
                        path.append("M").append(x).append(' ').append(y).append("h1v1h-1z");
            return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"320\""
                    + " viewBox=\"0 0 "
                    + size
                    + " "
                    + size
                    + "\" shape-rendering=\"crispEdges\"><rect width=\"100%\" height=\"100%\""
                    + " fill=\"white\"/><path fill=\"black\" d=\""
                    + path
                    + "\"/></svg>";
        } catch (com.google.zxing.WriterException e) {
            throw new IllegalStateException("Cannot render QR", e);
        }
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public AttendancePreviewResponse preview(
            AuthPrincipal actor, long eventId, AttendanceScanRequest request) {
        Event event = event(eventId, false);
        var now = attendance.now();
        rules.requireWindow(event, now);
        var session = session(eventId, request.sessionId());
        if (!rules.active(event, session, now)
                || !cipher.matches(request.token(), session.tokenHash()))
            throw new ApiException(
                    409, "QR_SESSION_INVALID", "Mã QR không hợp lệ, đã đóng hoặc hết hạn.");
        var registration =
                registrations
                        .find(eventId, actor.userId())
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                404,
                                                "REGISTRATION_NOT_FOUND",
                                                "Bạn chưa đăng ký sự kiện này."));
        rules.requireRegistered(registration);
        var recorded = attendance.attendance(registration.id()).orElse(null);
        boolean present = recorded != null && recorded.result().equals("PRESENT");
        var expires =
                session.expiresAt().isBefore(event.endsAt()) ? session.expiresAt() : event.endsAt();
        return new AttendancePreviewResponse(
                eventId,
                event.version(),
                event.title(),
                event.location(),
                event.startsAt(),
                event.endsAt(),
                session.id(),
                expires,
                registration.id(),
                registration.version(),
                recorded == null ? 0 : recorded.version(),
                present);
    }

    @Override
    @Transactional
    public AttendanceResponse checkIn(AuthPrincipal actor, long eventId, CheckInRequest request) {
        Event event = event(eventId, true);
        User student = auth.requireActiveStudent(actor);
        var now = attendance.now();
        rules.requireWindow(event, now);
        var session = session(eventId, request.sessionId());
        if (!rules.active(event, session, now)
                || !cipher.matches(request.token(), session.tokenHash()))
            throw new ApiException(
                    409, "QR_SESSION_INVALID", "Mã QR không hợp lệ, đã đóng hoặc hết hạn.");
        var registration =
                registrations
                        .find(eventId, student.id())
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                404,
                                                "REGISTRATION_NOT_FOUND",
                                                "Bạn chưa đăng ký sự kiện này."));
        rules.requireRegistered(registration);
        if (request.eventVersion() != event.version()
                || request.registrationVersion() != registration.version())
            throw new ApiException(
                    409,
                    "CONFIRMATION_STALE",
                    "Sự kiện hoặc đăng ký đã thay đổi. Vui lòng quét/xem trước và xác nhận lại.");
        Attendance before = attendance.attendance(registration.id()).orElse(null);
        if (before != null && before.result().equals("PRESENT"))
            return AttendanceResponse.from(before);
        if (request.attendanceVersion() == null
                || request.attendanceVersion() != (before == null ? 0 : before.version()))
            throw new ApiException(
                    409,
                    "CONFIRMATION_STALE",
                    "Kết quả điểm danh đã thay đổi sau khi quét. Vui lòng xem trước và xác nhận"
                        + " lại.");
        var after =
                attendance.save(
                        registration,
                        before,
                        "PRESENT",
                        "QR",
                        session.id(),
                        student.id(),
                        "Student QR check-in");
        attendance.history(before, after, student.id(), "Student QR check-in");
        return AttendanceResponse.from(after);
    }

    @Override
    @Transactional
    public AttendanceResponse manual(
            AuthPrincipal actor,
            long eventId,
            long registrationId,
            ManualAttendanceRequest request) {
        Event event = owned(actor, eventId, true);
        auth.requireActiveOrganizer(actor);
        rules.requireManualTime(event, attendance.now());
        Registration registration = registration(eventId, registrationId);
        rules.requireRegistered(registration);
        Attendance before = attendance.attendance(registrationId).orElse(null);
        if (request.registrationVersion() != registration.version()
                || request.version() != (before == null ? 0 : before.version()))
            throw new ApiException(
                    409,
                    "VERSION_CONFLICT",
                    "Đăng ký hoặc kết quả điểm danh đã thay đổi. Vui lòng tải lại.");
        if (before != null && before.result().equals(request.result()))
            return AttendanceResponse.from(before);
        var after =
                attendance.save(
                        registration,
                        before,
                        request.result(),
                        "MANUAL",
                        null,
                        actor.userId(),
                        request.reason().strip());
        attendance.history(before, after, actor.userId(), request.reason().strip());
        return AttendanceResponse.from(after);
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public MyAttendanceResponse mine(AuthPrincipal actor, long eventId) {
        Event event = event(eventId, false);
        var registration = registrations.find(eventId, actor.userId()).orElse(null);
        Attendance result =
                registration == null ? null : attendance.attendance(registration.id()).orElse(null);
        String status = registration == null ? null : registration.status();
        return new MyAttendanceResponse(
                eventId,
                registration == null ? null : registration.id(),
                status,
                rules.state(status, result, !attendance.now().isBefore(event.endsAt())),
                result == null ? null : AttendanceResponse.from(result));
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public AttendanceHistoryPage history(
            AuthPrincipal actor, long eventId, long registrationId, int page, int size) {
        owned(actor, eventId, false);
        registration(eventId, registrationId);
        var rows = attendance.history(registrationId, page, size);
        return new AttendanceHistoryPage(
                rows.stream().limit(size).toList(), page, size, rows.size() > size);
    }
}
