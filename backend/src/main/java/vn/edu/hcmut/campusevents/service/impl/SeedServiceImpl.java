package vn.edu.hcmut.campusevents.service.impl;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.hcmut.campusevents.model.SeedOptions;
import vn.edu.hcmut.campusevents.repository.ISeedRepository;
import vn.edu.hcmut.campusevents.repository.IUserRepository;
import vn.edu.hcmut.campusevents.service.ISeedService;
import vn.edu.hcmut.campusevents.validation.PasswordValidator;

import java.util.List;
import java.util.Objects;

@Service
public class SeedServiceImpl implements ISeedService {
    private final IUserRepository users;
    private final ISeedRepository seed;
    private final PasswordEncoder encoder;

    public SeedServiceImpl(IUserRepository users, ISeedRepository seed, PasswordEncoder encoder) {
        this.users = users;
        this.seed = seed;
        this.encoder = encoder;
    }

    private long user(
            String email, String name, String role, String password, Long unit, String status) {
        var existing = users.email(email);
        if (existing.isPresent()) return existing.get().id();
        return users.insert(name, email, encoder.encode(password), role, unit, status, false);
    }

    @Override
    @Transactional
    public void initialize(SeedOptions options) {
        if (!options.bootstrap() && !options.development()) return;
        users.adminLock();
        if (options.bootstrap()) {
            String email =
                    Objects.requireNonNull(options.bootstrapEmail(), "Bootstrap email is required");
            String password =
                    Objects.requireNonNull(
                            options.bootstrapPassword(), "Bootstrap password is required");
            PasswordValidator.check(password);
            if (users.countActiveAdminsExcluding(0) == 0) {
                String normalized = PasswordValidator.normalizeEmail(email);
                if (users.email(normalized).isPresent()) {
                    throw new IllegalStateException(
                            "Bootstrap email already exists; no account was overwritten. Review the"
                                    + " existing account manually.");
                }
                user(normalized, "Quản trị viên", "ADMIN", password, null, "ACTIVE");
            }
        }
        if (!options.development()) return;
        String password =
                Objects.requireNonNull(
                        options.developmentPassword(), "Development seed password is required");
        PasswordValidator.check(password);
        long unit = seed.ensureDevelopmentUnit();
        long department = seed.developmentDepartmentId();
        user("admin.i1@example.test", "Admin I1", "ADMIN", password, null, "ACTIVE");
        user("admin2.i1@example.test", "Admin 2 I1", "ADMIN", password, null, "ACTIVE");
        long organizer =
                user(
                        "organizer.i1@example.test",
                        "Người tổ chức I1",
                        "ORGANIZER",
                        password,
                        unit,
                        "ACTIVE");
        for (String prefix : List.of("student", "locked")) {
            long student =
                    user(
                            prefix + ".i1@example.test",
                            prefix.equals("student") ? "Sinh viên I1" : "Sinh viên bị khóa",
                            "STUDENT",
                            password,
                            null,
                            prefix.equals("locked") ? "LOCKED" : "ACTIVE");
            seed.ensureStudentProfile(
                    student, prefix.equals("student") ? "I10001" : "I10002", department);
        }
        for (String status : List.of("DRAFT", "PUBLISHED"))
            seed.ensureEvent(organizer, unit, status);
    }
}
