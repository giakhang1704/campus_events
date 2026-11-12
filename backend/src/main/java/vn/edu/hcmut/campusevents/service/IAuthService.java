package vn.edu.hcmut.campusevents.service;

import vn.edu.hcmut.campusevents.dto.auth.RegisterRequest;
import vn.edu.hcmut.campusevents.model.AuthenticatedLogin;
import vn.edu.hcmut.campusevents.model.User;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;

import java.util.Optional;

public interface IAuthService {
    User register(RegisterRequest request);

    AuthenticatedLogin login(String email, String password, String previousToken);

    Optional<AuthPrincipal> authenticate(String rawToken);

    User currentUser(AuthPrincipal principal);

    void logout(AuthPrincipal principal);

    void password(AuthPrincipal principal, String oldPassword, String newPassword);

    User requireActiveStudent(AuthPrincipal principal);

    void requireActiveOrganizer(AuthPrincipal principal);
}
