package vn.edu.hcmut.campusevents.controller;

import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import vn.edu.hcmut.campusevents.dto.report.*;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.service.IReportService;

@RestController
@Validated
@RequestMapping("/api/organizer/events/{eventId}")
public class ReportController {
    private final IReportService reports;

    public ReportController(IReportService reports) {
        this.reports = reports;
    }

    @GetMapping("/report")
    public EventReportResponse summary(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive long eventId) {
        return reports.summary(actor, eventId);
    }

    @GetMapping("/attendance")
    public AttendancePage participants(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive long eventId,
            @RequestParam(required = false) @Pattern(regexp = "|REGISTERED|WAITLISTED|CANCELLED")
                    String status,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return reports.participants(
                actor, eventId, status == null ? "REGISTERED" : status, page, size);
    }

    @GetMapping(value = "/report.csv", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<byte[]> csv(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive long eventId,
            @RequestParam(required = false) @Pattern(regexp = "|REGISTERED|WAITLISTED|CANCELLED")
                    String status) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"bk-event-" + eventId + "-report.csv\"")
                .body(reports.csv(actor, eventId, status == null ? "REGISTERED" : status));
    }
}
