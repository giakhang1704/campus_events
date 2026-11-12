package vn.edu.hcmut.campusevents.security;

public record AuthPrincipal(long userId, long sessionId, String role, boolean mustChangePassword) {}
