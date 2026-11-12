package vn.edu.hcmut.campusevents.service.impl;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.hcmut.campusevents.dto.auth.RegisterRequest;
import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.model.AuthenticatedLogin;
import vn.edu.hcmut.campusevents.model.User;
import vn.edu.hcmut.campusevents.repository.*;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.security.SessionTokenManager;
import vn.edu.hcmut.campusevents.service.IAuthService;
import vn.edu.hcmut.campusevents.validation.PasswordValidator;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class AuthServiceImpl implements IAuthService {
    private final IUserRepository users;
    private final ISessionRepository sessions;
    private final ICatalogRepository catalogs;
    private final PasswordEncoder encoder;

    public AuthServiceImpl(
            IUserRepository users,
            ISessionRepository sessions,
            ICatalogRepository catalogs,
            PasswordEncoder encoder) {
        this.users = users;
        this.sessions = sessions;
        this.catalogs = catalogs;
        this.encoder = encoder;
    }

    @Override
    @Transactional
    public User register(RegisterRequest request) {
        PasswordValidator.check(request.password());
        String studentCode = request.studentCode().trim().toUpperCase(Locale.ROOT);
        if (request.fullName().isBlank() || studentCode.isBlank()) {
            throw new ApiException(400, "VALIDATION_ERROR", "Họ tên và MSSV không được trống.");
        }
        if (!catalogs.selectableDepartmentExists(request.departmentId())) {
            throw new ApiException(
                    400,
                    "INVALID_DEPARTMENT",
                    "Khoa không hợp lệ.",
                    Map.of("departmentId", "Vui lòng chọn khoa hợp lệ."));
        }
        long id =
                users.insert(
                        request.fullName().trim(),
                        PasswordValidator.normalizeEmail(request.email()),
                        encoder.encode(request.password()),
                        "STUDENT",
                        null,
                        "ACTIVE",
                        false);
        // Both inserts must succeed; duplicate MSSV rolls back the new user as well.
        users.insertStudentProfile(id, studentCode, request.departmentId(), request.studyYear());
        return users.find(id);
    }

    @Override
    @Transactional
    public AuthenticatedLogin login(String email, String password, String previousToken) {
        String denied =
                "Email hoặc mật khẩu không đúng hoặc tài khoản đã bị khóa. Nếu tài khoản bị khóa,"
                        + " vui lòng liên hệ quản trị viên.";
        User user =
                users.email(PasswordValidator.normalizeEmail(email))
                        .orElseThrow(() -> new ApiException(401, "INVALID_CREDENTIALS", denied));
        users.lock(user.id());
        user = users.find(user.id());
        if (!encoder.matches(password, user.passwordHash()) || !user.status().equals("ACTIVE")) {
            throw new ApiException(401, "INVALID_CREDENTIALS", denied);
        }
        if (previousToken != null) sessions.revokeToken(SessionTokenManager.digest(previousToken));
        String rawToken = SessionTokenManager.generate();
        sessions.create(user.id(), SessionTokenManager.digest(rawToken), user.authVersion());
        return new AuthenticatedLogin(rawToken, user);
    }

    @Override
    public Optional<AuthPrincipal> authenticate(String rawToken) {
        if (rawToken == null || rawToken.length() > 256) return Optional.empty();
        return sessions.authenticate(SessionTokenManager.digest(rawToken));
    }

    @Override
    public User currentUser(AuthPrincipal principal) {
        return users.find(principal.userId());
    }

    @Override
    @Transactional
    public void logout(AuthPrincipal principal) {
        sessions.revoke(principal.sessionId());
    }

    @Override
    @Transactional
    public void password(AuthPrincipal principal, String oldPassword, String newPassword) {
        PasswordValidator.check(newPassword);
        users.lock(principal.userId());
        if (!sessions.hasActiveSession(principal.userId(), principal.sessionId())) {
            throw new ApiException(401, "UNAUTHENTICATED", "Phiên đã hết hiệu lực.");
        }
        User user = users.find(principal.userId());
        if (!encoder.matches(oldPassword, user.passwordHash())) {
            throw new ApiException(
                    400, "INVALID_CURRENT_PASSWORD", "Mật khẩu hiện tại không đúng.");
        }
        if (encoder.matches(newPassword, user.passwordHash())) {
            throw new ApiException(
                    400, "PASSWORD_UNCHANGED", "Mật khẩu mới phải khác mật khẩu cũ.");
        }
        users.updatePassword(user.id(), encoder.encode(newPassword));
        sessions.revokeAll(user.id());
    }

    /** Participates in the event-write transaction and keeps the user lock until commit. */
    @Override
    @Transactional
    public void requireActiveOrganizer(AuthPrincipal principal) {
        users.lock(principal.userId());
        User user = users.find(principal.userId());
        if (!user.status().equals("ACTIVE")
                || !sessions.hasActiveSession(user.id(), principal.sessionId())) {
            throw new ApiException(
                    401, "UNAUTHENTICATED", "Phiên đã hết hiệu lực. Vui lòng đăng nhập lại.");
        }
        if (!user.role().equals("ORGANIZER") || user.mustChangePassword()) {
            throw new ApiException(
                    403,
                    "FORBIDDEN",
                    "Cần tài khoản Người tổ chức đã đổi mật khẩu để quản lý sự kiện.");
        }
    }
}
