package vn.edu.hcmut.campusevents.events;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import vn.edu.hcmut.campusevents.auth.AuthService;
import vn.edu.hcmut.campusevents.common.ApiException;
import vn.edu.hcmut.campusevents.events.model.EventStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EventReadServiceTest {
    private final EventRepository repository = mock(EventRepository.class);
    private final AuthService auth = mock(AuthService.class);
    private EventService service;

    @BeforeEach void setUp() {
        service = new EventService(repository, new EventRules(), auth);
    }

    @Test void trimsSearchAndKeepsExtraPaginationRowOutOfTheResponse() {
        var event = EventRulesTest.event(7, EventStatus.PUBLISHED);
        when(repository.listPublished("Java", 2, 1)).thenReturn(List.of(event, event));

        var result = service.listPublished("  Java  ", 2, 1);

        assertEquals(List.of(event), result.items());
        assertEquals(2, result.page());
        assertEquals(1, result.size());
        assertTrue(result.hasNext());
        verify(repository).listPublished("Java", 2, 1);
        verifyNoInteractions(auth);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2})
    void emptyAndLastPagesHaveNoNextPage(int count) {
        var event = EventRulesTest.event(7, EventStatus.PUBLISHED);
        var rows = java.util.Collections.nCopies(count, event);
        when(repository.listPublished("", 0, 2)).thenReturn(rows);

        var result = service.listPublished("", 0, 2);

        assertEquals(rows, result.items());
        assertFalse(result.hasNext());
        verifyNoInteractions(auth);
    }

    @Test void detailUsesThePublishedQueryAndRetainsAllEligibilityFields() {
        var published = EventRulesTest.event(7, EventStatus.PUBLISHED);
        when(repository.findPublished(10)).thenReturn(Optional.of(published));

        assertSame(published, service.getPublished(10));
        verify(repository, never()).find(anyLong(), anyBoolean());
        verifyNoInteractions(auth);
    }

    @Test void aHiddenOrMissingEventDoesNotFallBackToTheOrganizerReadPath() {
        when(repository.findPublished(10)).thenReturn(Optional.empty());

        var error = assertThrows(ApiException.class, () -> service.getPublished(10));

        assertEquals(404, error.status);
        assertEquals("EVENT_NOT_FOUND", error.code);
        verify(repository, never()).find(anyLong(), anyBoolean());
        verifyNoInteractions(auth);
    }
}
