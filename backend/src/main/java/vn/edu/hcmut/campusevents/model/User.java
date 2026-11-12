package vn.edu.hcmut.campusevents.model;

/** Internal account snapshot. Never serialize this record to an HTTP response or audit log. */
public record User(
        long id,
        String fullName,
        String email,
        String role,
        String status,
        boolean mustChangePassword,
        int version,
        Long organizationUnitId,
        String studentCode,
        Long departmentId,
        Integer studyYear,
        String passwordHash,
        int authVersion) {}
