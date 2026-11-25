package vn.edu.hcmut.campusevents.dto.account;

/** Public account contract; deliberately excludes credentials and session data. */
public record AccountResponse(
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
        Integer studyYear) {}
