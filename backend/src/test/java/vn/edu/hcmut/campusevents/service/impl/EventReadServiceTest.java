package vn.edu.hcmut.campusevents.service.impl;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.mapper.EventMapper;
import vn.edu.hcmut.campusevents.model.EventStatus;
import vn.edu.hcmut.campusevents.repository.ICatalogRepository;
import vn.edu.hcmut.campusevents.repository.IEventRepository;
import vn.edu.hcmut.campusevents.service.IAuthService;
import vn.edu.hcmut.campusevents.service.IEmailQueueService;
import vn.edu.hcmut.campusevents.service.IWaitlistService;
import vn.edu.hcmut.campusevents.support.EventFixtures;
import vn.edu.hcmut.campusevents.validation.EventRules;

import java.util.List;
import java.util.Optional;

class EventReadServiceTest {
    private final IEventRepository repository = mock(IEventRepository.class);
    private final IAuthService auth = mock(IAuthService.class);
    private EventServiceImpl service;
    private final ICatalogRepository catalogs = mock(ICatalogRepository.class);

    @BeforeEach
    void setUp() {
        service =
                new EventServiceImpl(
                        repository,
                        new EventRules(),
                        auth,
                        catalogs,
                        mock(IWaitlistService.class),
                        mock(IEmailQueueService.class));
    }

    @Test
    void trimsSearchAndKeepsExtraPaginationRowOutOfTheResponse() {
        var event = EventFixtures.event(7, EventStatus.PUBLISHED);
        when(repository.listPublished("Java", 2, 1)).thenReturn(List.of(event, event));

        var result = service.listPublished("  Java  ", 2, 1);

        assertEquals(List.of(EventMapper.toResponse(event)), result.items());
        assertEquals(2, result.page());
        assertEquals(1, result.size());
        assertTrue(result.hasNext());
        verify(repository).listPublished("Java", 2, 1);
        verifyNoInteractions(auth);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2})
    void emptyAndLastPagesHaveNoNextPage(int count) {
        var event = EventFixtures.event(7, EventStatus.PUBLISHED);
        var rows = java.util.Collections.nCopies(count, event);
        when(repository.listPublished("", 0, 2)).thenReturn(rows);

        var result = service.listPublished("", 0, 2);

        assertEquals(rows.stream().map(EventMapper::toResponse).toList(), result.items());
        assertFalse(result.hasNext());
        verifyNoInteractions(auth);
    }

    @Test
    void detailUsesThePublishedQueryAndRetainsAllEligibilityFields() {
        var published = EventFixtures.event(7, EventStatus.PUBLISHED);
        when(repository.findPublished(10)).thenReturn(Optional.of(published));

        assertSame(published, service.getPublished(10));
        verify(repository, never()).find(anyLong(), anyBoolean());
        verifyNoInteractions(auth);
    }

    @Test
    void aHiddenOrMissingEventDoesNotFallBackToTheOrganizerReadPath() {
        when(repository.findPublished(10)).thenReturn(Optional.empty());

        var error = assertThrows(ApiException.class, () -> service.getPublished(10));

        assertEquals(404, error.status);
        assertEquals("EVENT_NOT_FOUND", error.code);
        verify(repository, never()).find(anyLong(), anyBoolean());
        verifyNoInteractions(auth);
    }
}
