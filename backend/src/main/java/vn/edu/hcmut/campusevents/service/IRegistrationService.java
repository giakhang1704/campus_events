package vn.edu.hcmut.campusevents.service;

import vn.edu.hcmut.campusevents.dto.registration.*;
import vn.edu.hcmut.campusevents.model.RegistrationResult;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;

public interface IRegistrationService {
    RegistrationResult register(AuthPrincipal actor, long eventId);

    RegistrationResponse cancel(AuthPrincipal actor, long eventId, int version);

    RegistrationState state(AuthPrincipal actor, long eventId);

    RegistrationPage mine(AuthPrincipal actor, String status, int page, int size);

    ParticipantPage participants(
            AuthPrincipal actor, long eventId, String status, int page, int size);
}
