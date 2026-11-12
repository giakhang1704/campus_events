package vn.edu.hcmut.campusevents.repository;

import vn.edu.hcmut.campusevents.security.AuthPrincipal;

import java.util.Optional;

public interface ISessionRepository {
    Optional<AuthPrincipal> authenticate(String tokenHash);

    boolean hasActiveSession(long userId, long sessionId);

    void create(long userId, String tokenHash, int authVersion);

    void revokeToken(String tokenHash);

    void revoke(long sessionId);

    void revokeAll(long userId);
}
