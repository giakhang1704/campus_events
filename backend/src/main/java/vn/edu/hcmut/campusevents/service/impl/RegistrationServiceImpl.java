package vn.edu.hcmut.campusevents.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.hcmut.campusevents.dto.registration.*;
import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.model.*;
import vn.edu.hcmut.campusevents.repository.*;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.service.*;
import vn.edu.hcmut.campusevents.validation.RegistrationRules;

@Service
public class RegistrationServiceImpl implements IRegistrationService {
    private final IRegistrationRepository registrations;
    private final IEventRepository events;
    private final IAuthService auth;
    private final IWaitlistService waitlist;
    private final IEmailQueueService email;
    private final RegistrationRules rules;

    public RegistrationServiceImpl(
            IRegistrationRepository registrations,
            IEventRepository events,
            IAuthService auth,
            IWaitlistService waitlist,
            IEmailQueueService email,
            RegistrationRules rules) {
        this.registrations = registrations;
        this.events = events;
        this.auth = auth;
        this.waitlist = waitlist;
        this.email = email;
        this.rules = rules;
    }

    private Event event(long id, boolean lock) {
        return events.find(id, lock)
                .filter(e -> e.status() == EventStatus.PUBLISHED)
                .orElseThrow(
                        () ->
                                new ApiException(
                                        404,
                                        "EVENT_NOT_FOUND",
                                        "Không tìm thấy sự kiện đã công bố."));
    }

    @Override
    @Transactional
    public RegistrationResult register(AuthPrincipal actor, long eventId) {
        Event event = event(eventId, true);
        User user = auth.requireActiveStudent(actor);
        var existing = registrations.find(eventId, user.id());
        if (existing.isPresent() && !existing.get().status().equals("CANCELLED"))
            return new RegistrationResult(registrations.response(eventId, user.id()), false);
        rules.requireOpen(event, registrations.now());
        rules.requireEligible(event, user);
        // Older eligible waiters get available seats before a new applicant does.
        waitlist.promote(event);
        // A long queue must not let this applicant cross the registration deadline.
        rules.requireOpen(event, registrations.now());
        String status =
                events.countParticipants(eventId, "REGISTERED") < event.capacity()
                        ? "REGISTERED"
                        : "WAITLISTED";
        Registration after =
                existing.isPresent()
                        ? registrations.reactivate(existing.get(), status)
                        : registrations.insert(eventId, user.id(), status);
        if (existing.isEmpty())
            registrations.history(
                    after,
                    user.id(),
                    status.equals("REGISTERED") ? "REGISTER" : "JOIN_WAITLIST",
                    null,
                    null);
        if (status.equals("REGISTERED")) email.registration(event, after, "REGISTRATION_CONFIRMED");
        return new RegistrationResult(registrations.response(eventId, user.id()), true);
    }

    @Override
    @Transactional
    public RegistrationResponse cancel(AuthPrincipal actor, long eventId, int version) {
        Event event = event(eventId, true);
        User user = auth.requireActiveStudent(actor);
        Registration before =
                registrations
                        .find(eventId, user.id())
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                404,
                                                "REGISTRATION_NOT_FOUND",
                                                "Bạn chưa đăng ký sự kiện này."));
        if (before.status().equals("CANCELLED")) return registrations.response(eventId, user.id());
        if (version != before.version())
            throw new ApiException(
                    409, "VERSION_CONFLICT", "Đăng ký đã thay đổi. Vui lòng tải lại.");
        rules.requireBeforeStart(event, registrations.now());
        Registration after = registrations.cancel(before);
        registrations.history(after, user.id(), "CANCEL", before.status(), null);
        waitlist.promote(event);
        return registrations.response(eventId, user.id());
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public RegistrationState state(AuthPrincipal actor, long eventId) {
        Event event = event(eventId, false);
        User user = auth.currentUser(actor);
        var mine = registrations.find(eventId, actor.userId());
        int registered = events.countParticipants(eventId, "REGISTERED"),
                waiting = events.countParticipants(eventId, "WAITLISTED");
        boolean eligible =
                user.departmentId() != null
                        && user.studyYear() != null
                        && rules.eligible(event, user.departmentId(), user.studyYear());
        return new RegistrationState(
                eventId,
                mine.isPresent() ? registrations.response(eventId, user.id()) : null,
                eligible,
                rules.open(event, registrations.now()),
                registered,
                waiting,
                Math.max(0, event.capacity() - registered));
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public RegistrationPage mine(AuthPrincipal actor, String status, int page, int size) {
        var rows = registrations.listMine(actor.userId(), status, page, size);
        return new RegistrationPage(
                rows.stream().limit(size).toList(), page, size, rows.size() > size);
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ParticipantPage participants(
            AuthPrincipal actor, long eventId, String status, int page, int size) {
        Event event =
                events.find(eventId, false)
                        .filter(e -> e.organizerId() == actor.userId())
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                404,
                                                "EVENT_NOT_FOUND",
                                                "Không tìm thấy sự kiện trong phạm vi của bạn."));
        var rows = registrations.listParticipants(eventId, status, page, size);
        return new ParticipantPage(
                rows.stream().limit(size).toList(),
                page,
                size,
                rows.size() > size,
                events.countParticipants(eventId, "REGISTERED"),
                events.countParticipants(eventId, "WAITLISTED"),
                event.capacity());
    }
}
