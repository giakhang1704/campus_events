package vn.edu.hcmut.campusevents.service.impl;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import static vn.edu.hcmut.campusevents.support.EventFixtures.*;

import org.junit.jupiter.api.Test;

import vn.edu.hcmut.campusevents.model.*;
import vn.edu.hcmut.campusevents.repository.*;
import vn.edu.hcmut.campusevents.service.IEmailQueueService;
import vn.edu.hcmut.campusevents.validation.RegistrationRules;

import java.util.List;

class WaitlistServiceTest {
    private final IRegistrationRepository registrations = mock(IRegistrationRepository.class);
    private final IEventRepository events = mock(IEventRepository.class);
    private final IEmailQueueService email = mock(IEmailQueueService.class);
    private final WaitlistServiceImpl service =
            new WaitlistServiceImpl(registrations, events, email, new RegistrationRules());

    private Registration waiting(long id) {
        return new Registration(
                id, 10, id, "WAITLISTED", content().registrationOpensAt(), null, null, 1);
    }

    @Test
    void skipsIneligibleHeadAndPromotesOnlyAsManySeatsAsAvailable() {
        var event = event(1, EventStatus.PUBLISHED);
        when(registrations.now()).thenReturn(event.startsAt().minusMinutes(1));
        when(events.countParticipants(10, "REGISTERED")).thenReturn(19);
        var first = waiting(1);
        var second = waiting(2);
        var third = waiting(3);
        when(registrations.waiting(10))
                .thenReturn(
                        List.of(
                                new WaitlistCandidate(first, 1, 6, "ACTIVE", "STUDENT"),
                                new WaitlistCandidate(second, 1, 2, "ACTIVE", "STUDENT"),
                                new WaitlistCandidate(third, 1, 2, "ACTIVE", "STUDENT")));
        var promoted =
                new Registration(
                        2,
                        10,
                        2,
                        "REGISTERED",
                        second.waitlistedAt(),
                        event.startsAt().minusMinutes(1),
                        null,
                        2);
        when(registrations.promote(second)).thenReturn(promoted);
        assertEquals(1, service.promote(event));
        verify(registrations).recordSkip(first, 1);
        verify(registrations).history(promoted, null, "PROMOTE", "WAITLISTED", null);
        verify(email).registration(event, promoted, "WAITLIST_PROMOTED");
        verify(registrations, never()).promote(third);
    }

    @Test
    void rechecksClockInsideTheLoopSoPromotionStopsAtStart() {
        var event = event(1, EventStatus.PUBLISHED);
        when(registrations.now()).thenReturn(event.startsAt().minusNanos(1), event.startsAt());
        when(events.countParticipants(10, "REGISTERED")).thenReturn(0);
        when(registrations.waiting(10))
                .thenReturn(List.of(new WaitlistCandidate(waiting(1), 1, 2, "ACTIVE", "STUDENT")));
        assertEquals(0, service.promote(event));
        verify(registrations, never()).promote(any());
        verifyNoInteractions(email);
    }

    @Test
    void neverPromotesDraftsOrStartedEvents() {
        assertEquals(0, service.promote(event(1, EventStatus.DRAFT)));
        when(registrations.now()).thenReturn(content().startsAt());
        assertEquals(0, service.promote(event(1, EventStatus.PUBLISHED)));
        verifyNoInteractions(events, email);
    }
}
