package vn.edu.hcmut.campusevents.events;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.edu.hcmut.campusevents.auth.AuthPrincipal;
import vn.edu.hcmut.campusevents.auth.AuthService;
import vn.edu.hcmut.campusevents.common.ApiException;
import vn.edu.hcmut.campusevents.events.model.EventStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EventServiceTest {
    private final EventRepository repository = mock(EventRepository.class);
    private final AuthService auth = mock(AuthService.class);
    private final AuthPrincipal organizer = new AuthPrincipal(7, 1, "ORGANIZER", false);
    private EventService service;

    @BeforeEach void setUp() {
        service = new EventService(repository, new EventRules(), auth);
    }

    @Test void deniesUpdatesToAnotherOrganizersEvent() {
        when(repository.find(10, true)).thenReturn(Optional.of(EventRulesTest.event(8, EventStatus.DRAFT)));
        var error = assertThrows(ApiException.class, () -> service.update(organizer, 10, EventRulesTest.content()));
        assertEquals(404, error.status);
        verify(repository, never()).update(any(), any());
    }

    @Test void publicationDoesNotWriteOnVersionConflict() {
        when(repository.find(10, true)).thenReturn(Optional.of(EventRulesTest.event(7, EventStatus.DRAFT)));
        assertEquals(409, assertThrows(ApiException.class, () -> service.publish(organizer, 10, 2)).status);
        verify(repository, never()).publish(any());
    }

    @Test void repeatedPublicationKeepsExistingPublishedTimeAndVersion() {
        var published = EventRulesTest.event(7, EventStatus.PUBLISHED);
        when(repository.find(10, true)).thenReturn(Optional.of(published));
        assertSame(published, service.publish(organizer, 10, 1));
        verify(repository, never()).publish(any());
    }

    @Test void publicationChecksPersistedReferencesBeforeWriting() {
        when(repository.find(10, true)).thenReturn(Optional.of(EventRulesTest.event(7, EventStatus.DRAFT)));
        when(repository.organizationUnitExists(1)).thenReturn(false);
        assertEquals("INVALID_UNIT", assertThrows(ApiException.class, () -> service.publish(organizer, 10, 1)).code);
        verify(repository, never()).publish(any());
    }

    @Test void revokedActorCannotStartAnEventWrite() {
        doThrow(new ApiException(401, "UNAUTHENTICATED", "Expired")).when(auth).requireActiveOrganizer(organizer);
        assertEquals(401, assertThrows(ApiException.class, () -> service.create(organizer, EventRulesTest.content())).status);
        verifyNoInteractions(repository);
    }
}
