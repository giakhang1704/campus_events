package vn.edu.hcmut.campusevents.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.hcmut.campusevents.model.*;
import vn.edu.hcmut.campusevents.repository.*;
import vn.edu.hcmut.campusevents.service.*;
import vn.edu.hcmut.campusevents.validation.RegistrationRules;

@Service
public class WaitlistServiceImpl implements IWaitlistService {
    private final IRegistrationRepository registrations;
    private final IEventRepository events;
    private final IEmailQueueService email;
    private final RegistrationRules rules;

    public WaitlistServiceImpl(
            IRegistrationRepository registrations,
            IEventRepository events,
            IEmailQueueService email,
            RegistrationRules rules) {
        this.registrations = registrations;
        this.events = events;
        this.email = email;
        this.rules = rules;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public int promote(Event event) {
        if (event.status() != EventStatus.PUBLISHED
                || !registrations.now().isBefore(event.startsAt())) return 0;
        int seats = event.capacity() - events.countParticipants(event.id(), "REGISTERED"),
                promoted = 0;
        if (seats <= 0) return 0;
        for (WaitlistCandidate candidate : registrations.waiting(event.id())) {
            if (seats <= 0 || !registrations.now().isBefore(event.startsAt())) break;
            if (!candidate.role().equals("STUDENT")
                    || !candidate.accountStatus().equals("ACTIVE")
                    || !rules.eligible(event, candidate.departmentId(), candidate.studyYear())) {
                registrations.recordSkip(candidate.registration(), event.version());
                continue;
            }
            Registration after = registrations.promote(candidate.registration());
            registrations.history(after, null, "PROMOTE", "WAITLISTED", null);
            email.registration(event, after, "WAITLIST_PROMOTED");
            seats--;
            promoted++;
        }
        return promoted;
    }
}
