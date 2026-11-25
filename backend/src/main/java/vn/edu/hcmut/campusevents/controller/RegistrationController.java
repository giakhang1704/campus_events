package vn.edu.hcmut.campusevents.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import vn.edu.hcmut.campusevents.dto.registration.*;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.service.IRegistrationService;

@RestController
@Validated
@RequestMapping("/api")
public class RegistrationController {
    private final IRegistrationService registrations;

    public RegistrationController(IRegistrationService registrations) {
        this.registrations = registrations;
    }

    @PostMapping("/events/{eventId}/registrations")
    public ResponseEntity<RegistrationResponse> register(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive long eventId) {
        var result = registrations.register(actor, eventId);
        return ResponseEntity.status(result.changed() ? 201 : 200).body(result.registration());
    }

    @PostMapping("/events/{eventId}/registration/cancel")
    public RegistrationResponse cancel(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive long eventId,
            @Valid @RequestBody CancelRegistrationRequest request) {
        return registrations.cancel(actor, eventId, request.version());
    }

    @GetMapping("/events/{eventId}/registration")
    public RegistrationState state(
            @AuthenticationPrincipal AuthPrincipal actor, @PathVariable @Positive long eventId) {
        return registrations.state(actor, eventId);
    }

    @GetMapping("/me/registrations")
    public RegistrationPage mine(
            @AuthenticationPrincipal AuthPrincipal actor,
            @RequestParam(defaultValue = "") @Pattern(regexp = "|REGISTERED|WAITLISTED|CANCELLED")
                    String status,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return registrations.mine(actor, status, page, size);
    }

    @GetMapping("/organizer/events/{eventId}/registrations")
    public ParticipantPage participants(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable @Positive long eventId,
            @RequestParam(defaultValue = "") @Pattern(regexp = "|REGISTERED|WAITLISTED|CANCELLED")
                    String status,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return registrations.participants(actor, eventId, status, page, size);
    }
}
