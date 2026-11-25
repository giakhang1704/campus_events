package vn.edu.hcmut.campusevents.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.hcmut.campusevents.model.*;
import vn.edu.hcmut.campusevents.repository.*;
import vn.edu.hcmut.campusevents.service.IEmailQueueService;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class EmailQueueServiceImpl implements IEmailQueueService {
    private final IEmailOutboxRepository outbox;
    private final IRegistrationRepository registrations;

    public EmailQueueServiceImpl(
            IEmailOutboxRepository outbox, IRegistrationRepository registrations) {
        this.outbox = outbox;
        this.registrations = registrations;
    }

    private Map<String, Object> payload(Event event, Registration r) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("registrationVersion", r.version());
        p.put("eventTitle", event.title());
        p.put("location", event.location());
        p.put("startsAt", event.startsAt().toString());
        p.put("endsAt", event.endsAt().toString());
        return p;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void registration(Event event, Registration r, String kind) {
        outbox.enqueue(
                event, r, registrations.recipientEmail(r.studentId()), kind, payload(event, r));
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void eventChanged(Event before, Event after) {
        for (Registration r : registrations.activeRegistrations(after.id())) {
            var p = payload(after, r);
            p.put("previousLocation", before.location());
            p.put("previousStartsAt", before.startsAt().toString());
            p.put("previousEndsAt", before.endsAt().toString());
            p.put("registrationOpensAt", after.registrationOpensAt().toString());
            p.put("registrationClosesAt", after.registrationClosesAt().toString());
            p.put("previousRegistrationOpensAt", before.registrationOpensAt().toString());
            p.put("previousRegistrationClosesAt", before.registrationClosesAt().toString());
            outbox.enqueue(
                    after, r, registrations.recipientEmail(r.studentId()), "EVENT_CHANGED", p);
        }
    }
}
