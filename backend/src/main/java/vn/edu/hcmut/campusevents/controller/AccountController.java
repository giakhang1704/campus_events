package vn.edu.hcmut.campusevents.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import vn.edu.hcmut.campusevents.dto.account.*;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.service.IAccountService;

@RestController
@Validated
@RequestMapping("/api/admin/users")
public class AccountController {
    private final IAccountService accounts;

    public AccountController(IAccountService accounts) {
        this.accounts = accounts;
    }

    @GetMapping
    public AccountPageResponse list(
            @RequestParam(defaultValue = "") @Size(max = 100) String q,
            @RequestParam(defaultValue = "") @Pattern(regexp = "|STUDENT|ORGANIZER|ADMIN")
                    String role,
            @RequestParam(defaultValue = "") @Pattern(regexp = "|ACTIVE|LOCKED") String status,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return accounts.list(q, role, status, page, size);
    }

    @PostMapping("/{id}/status/preview")
    public AccountChangePreviewResponse previewStatus(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable long id,
            @Valid @RequestBody ChangeAccountStatusRequest request) {
        return accounts.previewStatus(principal, id, request);
    }

    @PostMapping
    public ResponseEntity<AccountResponse> create(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody CreateOrganizerRequest request) {
        return ResponseEntity.status(201).body(accounts.create(principal, request));
    }

    @PatchMapping("/{id}/status")
    public AccountResponse status(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable long id,
            @Valid @RequestBody ChangeAccountStatusRequest request) {
        return accounts.status(principal, id, request);
    }
}
