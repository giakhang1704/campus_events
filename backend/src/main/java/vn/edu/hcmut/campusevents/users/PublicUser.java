package vn.edu.hcmut.campusevents.users;
public record PublicUser(long id,String fullName,String email,String role,String status,boolean mustChangePassword,int version,
 Long organizationUnitId,String studentCode,Long departmentId,Integer studyYear) {}
