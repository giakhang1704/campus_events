package vn.edu.hcmut.campusevents.auth;
public record AuthPrincipal(long userId,long sessionId,String role,boolean mustChangePassword) {}
