package vn.edu.hcmut.campusevents.events;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import vn.edu.hcmut.campusevents.common.ApiException;
import vn.edu.hcmut.campusevents.events.dto.EventRequest;
import vn.edu.hcmut.campusevents.events.model.Event;
import vn.edu.hcmut.campusevents.events.model.EventStatus;
import static org.junit.jupiter.api.Assertions.*;

class EventRulesTest {
    private final EventRules rules = new EventRules();

    static EventRequest content() {
        return new EventRequest("Workshop", "Description", "Room A", 1L,
                OffsetDateTime.parse("2026-11-10T08:00:00+07:00"),
                OffsetDateTime.parse("2026-11-11T08:00:00+07:00"),
                OffsetDateTime.parse("2026-11-11T08:00:00+07:00"),
                OffsetDateTime.parse("2026-11-11T10:00:00+07:00"),
                20, List.of(1L, 2L), List.of(1, 2), 1);
    }

    static Event event(long owner, EventStatus status) {
        var c = content();
        return new Event(10, owner, c.organizationUnitId(), c.title(), c.description(), c.location(),
                c.registrationOpensAt(), c.registrationClosesAt(), c.startsAt(), c.endsAt(), c.capacity(),
                status, status == EventStatus.PUBLISHED ? c.registrationOpensAt() : null, 1,
                c.departmentIds(), c.studyYears());
    }

    @Test void allowsRegistrationClosingAtEventStart() {
        assertDoesNotThrow(() -> rules.validateContent(content()));
    }

    @Test void comparesInstantsAcrossDifferentOffsets() {
        var c = content();
        var invalid = new EventRequest(c.title(), c.description(), c.location(), 1L,
                c.registrationOpensAt(), c.registrationOpensAt().withOffsetSameInstant(java.time.ZoneOffset.UTC),
                c.startsAt(), c.endsAt(), 20, List.of(), List.of(), 1);
        var error = assertThrows(ApiException.class, () -> rules.validateContent(invalid));
        assertTrue(error.fields.containsKey("registrationClosesAt"));
    }

    @Test void reportsAllInvalidTimeBoundaries() {
        var c = content();
        var invalid = new EventRequest(c.title(), c.description(), c.location(), 1L,
                c.endsAt(), c.startsAt(), c.registrationOpensAt(), c.registrationOpensAt(), 20, List.of(), List.of(), 1);
        var error = assertThrows(ApiException.class, () -> rules.validateContent(invalid));
        assertEquals(3, error.fields.size());
    }

    @Test void rejectsDuplicateEligibilityValues() {
        var c = content();
        var invalid = new EventRequest(c.title(), c.description(), c.location(), 1L,
                c.registrationOpensAt(), c.registrationClosesAt(), c.startsAt(), c.endsAt(),
                20, List.of(1L, 1L), List.of(2, 2), 1);
        var error = assertThrows(ApiException.class, () -> rules.validateContent(invalid));
        assertTrue(error.fields.containsKey("departmentIds"));
        assertTrue(error.fields.containsKey("studyYears"));
    }

    @Test void requiresVersionAndRejectsStaleVersion() {
        assertEquals(400, assertThrows(ApiException.class, () -> rules.requireVersion(event(7, EventStatus.DRAFT), null)).status);
        assertEquals(409, assertThrows(ApiException.class, () -> rules.requireVersion(event(7, EventStatus.DRAFT), 2)).status);
    }

    @Test void protectsExistingParticipantsAndWaitlist() {
        assertEquals("CAPACITY_BELOW_REGISTERED", assertThrows(ApiException.class,
                () -> rules.validateParticipantImpact(event(7, EventStatus.PUBLISHED), content(), 21, 0)).code);
        var before = event(7, EventStatus.PUBLISHED);
        var c = content();
        var increased = new EventRequest(c.title(), c.description(), c.location(), 1L,
                c.registrationOpensAt(), c.registrationClosesAt(), c.startsAt(), c.endsAt(),
                30, c.departmentIds(), c.studyYears(), 1);
        assertEquals("WAITLIST_PROCESSING_REQUIRED", assertThrows(ApiException.class,
                () -> rules.validateParticipantImpact(before, increased, 10, 1)).code);
    }
}
