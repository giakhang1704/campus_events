package vn.edu.hcmut.campusevents.service;

import vn.edu.hcmut.campusevents.dto.report.*;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;

public interface IReportService {
    EventReportResponse summary(AuthPrincipal actor, long eventId);

    AttendancePage participants(
            AuthPrincipal actor, long eventId, String status, int page, int size);

    byte[] csv(AuthPrincipal actor, long eventId, String status);
}
