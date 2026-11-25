package vn.edu.hcmut.campusevents.service.impl;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.hcmut.campusevents.dto.account.*;
import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.mapper.AccountMapper;
import vn.edu.hcmut.campusevents.model.User;
import vn.edu.hcmut.campusevents.repository.*;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.service.IAccountService;
import vn.edu.hcmut.campusevents.validation.PasswordValidator;

@Service
public class AccountServiceImpl implements IAccountService {
    private final IUserRepository users;
    private final ISessionRepository sessions;
    private final IAccountHistoryRepository history;
    private final ICatalogRepository catalogs;
    private final IEventRepository events;
    private final PasswordEncoder encoder;

    public AccountServiceImpl(
            IUserRepository users,
            ISessionRepository sessions,
            IAccountHistoryRepository history,
            ICatalogRepository catalogs,
            IEventRepository events,
            PasswordEncoder encoder) {
        this.users = users;
        this.sessions = sessions;
        this.history = history;
        this.catalogs = catalogs;
        this.events = events;
        this.encoder = encoder;
    }

    @Override
    @Transactional(readOnly = true)
    public AccountPageResponse list(String query, String role, String status, int page, int size) {
        var rows = users.list(query, role, status, page, size);
        return new AccountPageResponse(
                rows.stream().limit(size).map(AccountMapper::toResponse).toList(),
                page,
                size,
                rows.size() > size);
    }

    private void requireAdmin(AuthPrincipal principal) {
        User user = users.find(principal.userId());
        if (!user.role().equals("ADMIN") || !user.status().equals("ACTIVE")) {
            throw new ApiException(403, "FORBIDDEN", "Quyền quản trị đã thay đổi.");
        }
    }

    private User target(AuthPrincipal actor, long id, int version) {
        users.adminLock();
        requireAdmin(actor);
        if (actor.userId() == id)
            throw new ApiException(409, "SELF_MODIFICATION", "Không được tự khóa tài khoản.");
        users.find(id); // Keep the existing 404 response before acquiring the row lock.
        users.lock(id);
        User before = users.find(id);
        if (before.version() != version) {
            throw new ApiException(
                    409, "VERSION_CONFLICT", "Tài khoản đã được cập nhật. Vui lòng tải lại.");
        }
        return before;
    }

    private void checkStatus(User before, String status) {
        if (before.status().equals(status) || !status.equals("LOCKED")) return;
        if (before.role().equals("ADMIN")
                && before.status().equals("ACTIVE")
                && users.countActiveAdminsExcluding(before.id()) == 0) {
            throw new ApiException(
                    409, "LAST_ACTIVE_ADMIN", "Phải giữ ít nhất một Admin đang hoạt động.");
        }
        if (before.role().equals("ORGANIZER") && events.hasUnfinishedEvents(before.id())) {
            throw new ApiException(
                    409,
                    "ORGANIZER_HAS_EVENTS",
                    "Người tổ chức còn sự kiện nháp hoặc chưa kết thúc.");
        }
    }

    @Override
    @Transactional
    public AccountChangePreviewResponse previewStatus(
            AuthPrincipal actor, long id, ChangeAccountStatusRequest request) {
        User before = target(actor, id, request.version());
        checkStatus(before, request.status());
        boolean changed = !before.status().equals(request.status());
        String impact =
                !changed
                        ? "Không có thay đổi."
                        : request.status().equals("LOCKED")
                                ? "Tài khoản sẽ bị khóa và mọi phiên đăng nhập bị thu hồi. Dữ liệu"
                                        + " đăng ký và điểm danh được giữ."
                                : "Tài khoản được mở khóa và có thể đăng nhập lại. Các phiên cũ"
                                        + " không được khôi phục.";
        return new AccountChangePreviewResponse(
                AccountMapper.toResponse(before),
                before.role(),
                request.status(),
                before.organizationUnitId(),
                request.reason().trim(),
                changed,
                impact);
    }

    @Override
    @Transactional
    public AccountResponse create(AuthPrincipal actor, CreateOrganizerRequest request) {
        PasswordValidator.check(request.temporaryPassword());
        if (request.fullName().isBlank())
            throw new ApiException(400, "VALIDATION_ERROR", "Họ tên không được trống.");
        users.adminLock();
        requireAdmin(actor);
        if (!catalogs.organizationUnitExists(request.organizationUnitId())) {
            throw new ApiException(400, "INVALID_UNIT", "Đơn vị không hợp lệ.");
        }
        long id =
                users.insert(
                        request.fullName().trim(),
                        PasswordValidator.normalizeEmail(request.email()),
                        encoder.encode(request.temporaryPassword()),
                        "ORGANIZER",
                        request.organizationUnitId(),
                        "ACTIVE",
                        true);
        AccountResponse after = AccountMapper.toResponse(users.find(id));
        history.record(id, actor.userId(), "CREATE_ORGANIZER", null, after, request.reason());
        return after;
    }

    @Override
    @Transactional
    public AccountResponse status(
            AuthPrincipal actor, long id, ChangeAccountStatusRequest request) {
        User before = target(actor, id, request.version());
        if (before.status().equals(request.status())) return AccountMapper.toResponse(before);
        checkStatus(before, request.status());
        // All three writes share this transaction; audit failure rolls everything back.
        users.updateStatus(id, request.status());
        sessions.revokeAll(id);
        AccountResponse after = AccountMapper.toResponse(users.find(id));
        history.record(
                id,
                actor.userId(),
                request.status().equals("LOCKED") ? "LOCK" : "UNLOCK",
                AccountMapper.toResponse(before),
                after,
                request.reason());
        return after;
    }
}
