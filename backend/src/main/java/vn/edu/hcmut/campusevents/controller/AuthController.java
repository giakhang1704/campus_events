package vn.edu.hcmut.campusevents.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

import vn.edu.hcmut.campusevents.dto.account.AccountResponse;
import vn.edu.hcmut.campusevents.dto.auth.*;
import vn.edu.hcmut.campusevents.mapper.AccountMapper;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.security.SessionCookieManager;
import vn.edu.hcmut.campusevents.service.IAuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final IAuthService auth;
    private final SessionCookieManager cookies;

    public AuthController(IAuthService auth, SessionCookieManager cookies) {
        this.auth = auth;
        this.cookies = cookies;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getToken(), token.getHeaderName());
    }

    @PostMapping("/register")
    public ResponseEntity<AccountResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(201).body(AccountMapper.toResponse(auth.register(request)));
    }

    @PostMapping("/login")
    public AccountResponse login(
            @Valid @RequestBody LoginRequest body,
            HttpServletRequest request,
            HttpServletResponse response) {
        var login = auth.login(body.email(), body.password(), SessionCookieManager.token(request));
        cookies.write(response, login.token(), 28800);
        return AccountMapper.toResponse(login.user());
    }

    @GetMapping("/me")
    public AccountResponse me(@AuthenticationPrincipal AuthPrincipal principal) {
        return AccountMapper.toResponse(auth.currentUser(principal));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @AuthenticationPrincipal AuthPrincipal principal, HttpServletResponse response) {
        if (principal != null) auth.logout(principal);
        cookies.write(response, "", 0);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password")
    public ResponseEntity<Void> password(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletResponse response) {
        auth.password(principal, request.currentPassword(), request.newPassword());
        cookies.write(response, "", 0);
        return ResponseEntity.noContent().build();
    }
}
