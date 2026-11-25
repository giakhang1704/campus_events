package vn.edu.hcmut.campusevents.repository;

import vn.edu.hcmut.campusevents.dto.registration.*;
import vn.edu.hcmut.campusevents.model.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface IRegistrationRepository {
    OffsetDateTime now();

    Optional<Registration> find(long eventId, long studentId);

    Registration insert(long eventId, long studentId, String status);

    Registration reactivate(Registration before, String status);

    Registration cancel(Registration before);

    Registration promote(Registration before);

    List<WaitlistCandidate> waiting(long eventId);

    void history(
            Registration registration,
            Long actorId,
            String action,
            String oldStatus,
            String reason);

    void recordSkip(Registration registration, int eventVersion);

    RegistrationResponse response(long eventId, long studentId);

    List<RegistrationResponse> listMine(long studentId, String status, int page, int size);

    List<ParticipantResponse> listParticipants(long eventId, String status, int page, int size);

    List<Registration> activeRegistrations(long eventId);

    String recipientEmail(long studentId);
}
