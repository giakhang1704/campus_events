package vn.edu.hcmut.campusevents.validation;

import static org.junit.jupiter.api.Assertions.*;

import static vn.edu.hcmut.campusevents.support.EventFixtures.*;

import org.junit.jupiter.api.Test;

import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.model.EventContent;
import vn.edu.hcmut.campusevents.model.EventStatus;

import java.util.List;

class EventRulesTest {
    private final EventRules rules = new EventRules();

    @Test
    void allowsRegistrationClosingAtEventStart() {
        assertDoesNotThrow(() -> rules.validateContent(content()));
    }

    @Test
    void comparesInstantsAcrossDifferentOffsets() {
        var c = content();
        var invalid =
                new EventContent(
                        c.title(),
                        c.description(),
                        c.location(),
                        1L,
                        c.registrationOpensAt(),
                        c.registrationOpensAt().withOffsetSameInstant(java.time.ZoneOffset.UTC),
                        c.startsAt(),
                        c.endsAt(),
                        20,
                        List.of(),
                        List.of(),
                        1);
        var error = assertThrows(ApiException.class, () -> rules.validateContent(invalid));
        assertTrue(error.fields.containsKey("registrationClosesAt"));
    }

    @Test
    void reportsAllInvalidTimeBoundaries() {
        var c = content();
        var invalid =
                new EventContent(
                        c.title(),
                        c.description(),
                        c.location(),
                        1L,
                        c.endsAt(),
                        c.startsAt(),
                        c.registrationOpensAt(),
                        c.registrationOpensAt(),
                        20,
                        List.of(),
                        List.of(),
                        1);
        var error = assertThrows(ApiException.class, () -> rules.validateContent(invalid));
        assertEquals(3, error.fields.size());
    }

    @Test
    void rejectsDuplicateEligibilityValues() {
        var c = content();
        var invalid =
                new EventContent(
                        c.title(),
                        c.description(),
                        c.location(),
                        1L,
                        c.registrationOpensAt(),
                        c.registrationClosesAt(),
                        c.startsAt(),
                        c.endsAt(),
                        20,
                        List.of(1L, 1L),
                        List.of(2, 2),
                        1);
        var error = assertThrows(ApiException.class, () -> rules.validateContent(invalid));
        assertTrue(error.fields.containsKey("departmentIds"));
        assertTrue(error.fields.containsKey("studyYears"));
    }

    @Test
    void requiresVersionAndRejectsStaleVersion() {
        assertEquals(
                400,
                assertThrows(
                                ApiException.class,
                                () -> rules.requireVersion(event(7, EventStatus.DRAFT), null))
                        .status);
        assertEquals(
                409,
                assertThrows(
                                ApiException.class,
                                () -> rules.requireVersion(event(7, EventStatus.DRAFT), 2))
                        .status);
    }

    @Test
    void protectsExistingParticipantsAndWaitlist() {
        assertEquals(
                "CAPACITY_BELOW_REGISTERED",
                assertThrows(
                                ApiException.class,
                                () ->
                                        rules.validateParticipantImpact(
                                                event(7, EventStatus.PUBLISHED), content(), 21, 0))
                        .code);
        var before = event(7, EventStatus.PUBLISHED);
        var c = content();
        var increased =
                new EventContent(
                        c.title(),
                        c.description(),
                        c.location(),
                        1L,
                        c.registrationOpensAt(),
                        c.registrationClosesAt(),
                        c.startsAt(),
                        c.endsAt(),
                        30,
                        c.departmentIds(),
                        c.studyYears(),
                        1);
        assertDoesNotThrow(() -> rules.validateParticipantImpact(before, increased, 10, 1));
    }
}
