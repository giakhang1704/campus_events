package vn.edu.hcmut.campusevents.model;

/** Raw token is transient: only its digest is persisted; it is delivered via HttpOnly cookie. */
public record AuthenticatedLogin(String token, User user) {}
