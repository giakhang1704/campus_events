package vn.edu.hcmut.campusevents.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import vn.edu.hcmut.campusevents.dto.attendance.*;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.service.IAttendanceService;

@RestController
@Validated
@RequestMapping("/api")
public class AttendanceController {
    private final IAttendanceService attendance;

    public AttendanceController(IAttendanceService attendance) {
        this.attendance = attendance;
    }

    @PostMapping("/organizer/events/{eventId}/attendance/sessions")
    public ResponseEntity<QrSessionResponse> open(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive long eventId,
            @Valid @RequestBody OpenAttendanceRequest request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(attendance.open(actor, eventId, request.durationMinutes()));
    }

    @GetMapping("/organizer/events/{eventId}/attendance/session")
    public ResponseEntity<QrSessionResponse> current(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive long eventId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(attendance.current(actor, eventId));
    }

    @PostMapping("/organizer/events/{eventId}/attendance/sessions/{sessionId}/close")
    public QrSessionResponse close(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive long eventId,
            @PathVariable @Positive long sessionId) {
        return attendance.close(actor, eventId, sessionId);
    }

    @GetMapping(
            value = "/organizer/events/{eventId}/attendance/sessions/{sessionId}/qr.svg",
            produces = "image/svg+xml")
    public ResponseEntity<String> svg(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive long eventId,
            @PathVariable @Positive long sessionId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(attendance.svg(actor, eventId, sessionId));
    }

    @PostMapping("/events/{eventId}/attendance/check-in")
    public AttendanceResponse checkIn(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive long eventId,
            @Valid @RequestBody CheckInRequest request) {
        return attendance.checkIn(actor, eventId, request);
    }

    @PostMapping("/events/{eventId}/attendance/preview")
    public ResponseEntity<AttendancePreviewResponse> preview(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive long eventId,
            @Valid @RequestBody AttendanceScanRequest request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(attendance.preview(actor, eventId, request));
    }

    @GetMapping("/events/{eventId}/attendance")
    public MyAttendanceResponse mine(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive long eventId) {
        return attendance.mine(actor, eventId);
    }

    @PutMapping("/organizer/events/{eventId}/attendance/{registrationId}")
    public AttendanceResponse manual(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive long eventId,
            @PathVariable @Positive long registrationId,
            @Valid @RequestBody ManualAttendanceRequest request) {
        return attendance.manual(actor, eventId, registrationId, request);
    }

    @GetMapping("/organizer/events/{eventId}/attendance/{registrationId}/history")
    public AttendanceHistoryPage history(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive long eventId,
            @PathVariable @Positive long registrationId,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return attendance.history(actor, eventId, registrationId, page, size);
    }
}
