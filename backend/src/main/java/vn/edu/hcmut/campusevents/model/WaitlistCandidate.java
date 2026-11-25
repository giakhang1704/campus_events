package vn.edu.hcmut.campusevents.model;

public record WaitlistCandidate(
        Registration registration,
        long departmentId,
        int studyYear,
        String accountStatus,
        String role) {}
