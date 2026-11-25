package vn.edu.hcmut.campusevents.repository;

import vn.edu.hcmut.campusevents.model.User;

import java.util.List;
import java.util.Optional;

public interface IUserRepository {
    User find(long id);

    Optional<User> email(String email);

    List<User> list(String query, String role, String status, int page, int size);

    void adminLock();

    void lock(long id);

    int countActiveAdminsExcluding(long id);

    long insert(
            String name,
            String email,
            String hash,
            String role,
            Long unit,
            String status,
            boolean mustChangePassword);

    void insertStudentProfile(long userId, String code, long departmentId, int year);

    void updateStatus(long id, String status);

    void updatePassword(long id, String hash);
}
