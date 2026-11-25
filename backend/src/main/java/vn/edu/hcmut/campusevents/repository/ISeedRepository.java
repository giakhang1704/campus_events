package vn.edu.hcmut.campusevents.repository;

public interface ISeedRepository {
    long ensureDevelopmentUnit();

    long developmentDepartmentId();

    void ensureStudentProfile(long userId, String code, long departmentId);

    void ensureEvent(long organizerId, long unitId, String status);
}
