package vn.edu.hcmut.campusevents.validation;

import static org.junit.jupiter.api.Assertions.*;

import static vn.edu.hcmut.campusevents.support.EventFixtures.*;

import org.junit.jupiter.api.Test;

import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.model.EventStatus;

import java.time.ZoneOffset;
import java.util.List;

class RegistrationRulesTest {
    private final RegistrationRules rules = new RegistrationRules();

    @Test
    void includesOpeningInstantButExcludesClosingAndStart() {
        var event = event(1, EventStatus.PUBLISHED);
        assertFalse(rules.open(event, event.registrationOpensAt().minusNanos(1)));
        assertTrue(rules.open(event, event.registrationOpensAt()));
        assertTrue(rules.open(event, event.registrationClosesAt().minusNanos(1)));
        assertFalse(rules.open(event, event.registrationClosesAt()));
        assertFalse(rules.open(event, event.startsAt()));
        assertEquals(
                "REGISTRATION_CLOSED",
                assertThrows(
                                ApiException.class,
                                () -> rules.requireOpen(event, event.registrationClosesAt()))
                        .code);
    }

    @Test
    void draftsNeverAcceptRegistrationAndOffsetsRepresentTheSameInstant() {
        var published = event(1, EventStatus.PUBLISHED);
        assertFalse(rules.open(event(1, EventStatus.DRAFT), published.registrationOpensAt()));
        assertTrue(
                rules.open(
                        published,
                        published.registrationOpensAt().withOffsetSameInstant(ZoneOffset.UTC)));
    }

    @Test
    void requiresBothDepartmentAndYearButEmptyGroupsAllowAll() {
        var restricted = event(1, EventStatus.PUBLISHED);
        assertTrue(rules.eligible(restricted, 1, 2));
        assertFalse(rules.eligible(restricted, 3, 2));
        assertFalse(rules.eligible(restricted, 1, 3));
        assertTrue(rules.eligible(restricted.withRestrictions(List.of(), List.of()), 99, 6));
        assertFalse(rules.eligible(restricted.withRestrictions(List.of(), List.of(2)), 99, 3));
    }

    @Test
    void cancellationIsAllowedOnlyStrictlyBeforeStart() {
        var event = event(1, EventStatus.PUBLISHED);
        assertDoesNotThrow(() -> rules.requireBeforeStart(event, event.startsAt().minusNanos(1)));
        assertEquals(
                "EVENT_STARTED",
                assertThrows(
                                ApiException.class,
                                () -> rules.requireBeforeStart(event, event.startsAt()))
                        .code);
    }
}
