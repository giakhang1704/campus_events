package vn.edu.hcmut.campusevents.validation;

import static org.junit.jupiter.api.Assertions.*;

import static vn.edu.hcmut.campusevents.support.EventFixtures.*;

import org.junit.jupiter.api.Test;

import vn.edu.hcmut.campusevents.model.*;

class AttendanceRulesTest {
    private final AttendanceRules rules = new AttendanceRules();

    @Test
    void includesExactlyThirtyMinutesEarlyButExcludesEnd() {
        var e = event(1, EventStatus.PUBLISHED);
        assertFalse(rules.window(e, e.startsAt().minusMinutes(30).minusNanos(1)));
        assertTrue(rules.window(e, e.startsAt().minusMinutes(30)));
        assertTrue(rules.window(e, e.endsAt().minusNanos(1)));
        assertFalse(rules.window(e, e.endsAt()));
        assertFalse(rules.window(event(1, EventStatus.DRAFT), e.startsAt()));
    }

    @Test
    void closingOrExpiryImmediatelyInvalidatesSession() {
        var e = event(1, EventStatus.PUBLISHED);
        var now = e.startsAt();
        var session =
                new AttendanceSession(
                        1, e.id(), now.minusMinutes(1), now.plusMinutes(1), null, "hash", "cipher");
        assertTrue(rules.active(e, session, now));
        assertFalse(rules.active(e, session, session.expiresAt()));
        assertFalse(
                rules.active(
                        e,
                        new AttendanceSession(
                                1,
                                e.id(),
                                session.openedAt(),
                                session.expiresAt(),
                                now,
                                "hash",
                                "cipher"),
                        now));
    }

    @Test
    void absenceIsDerivedAndCancelledHistoricalPresentDoesNotCount() {
        assertEquals("NOT_RECORDED", rules.state("REGISTERED", null, false));
        assertEquals("ABSENT", rules.state("REGISTERED", null, true));
        var a =
                new Attendance(
                        1, 1, "PRESENT", "MANUAL", null, 1, content().startsAt(), "reason", 1);
        assertEquals("PRESENT", rules.state("REGISTERED", a, true));
        assertEquals("NOT_APPLICABLE", rules.state("CANCELLED", a, true));
        assertEquals("NOT_APPLICABLE", rules.state("WAITLISTED", null, false));
    }
}
