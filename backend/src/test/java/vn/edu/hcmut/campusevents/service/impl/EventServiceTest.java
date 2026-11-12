package vn.edu.hcmut.campusevents.service.impl;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.model.EventStatus;
import vn.edu.hcmut.campusevents.repository.ICatalogRepository;
import vn.edu.hcmut.campusevents.repository.IEventRepository;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.service.IAuthService;
import vn.edu.hcmut.campusevents.support.EventFixtures;
import vn.edu.hcmut.campusevents.validation.EventRules;

import java.util.Optional;

class EventServiceTest {
    private final IEventRepository repository = mock(IEventRepository.class);
    private final IAuthService auth = mock(IAuthService.class);
    private final AuthPrincipal organizer = new AuthPrincipal(7, 1, "ORGANIZER", false);
    private EventServiceImpl service;
    private final ICatalogRepository catalogs = mock(ICatalogRepository.class);

    @BeforeEach
    void setUp() {
        service = new EventServiceImpl(repository, new EventRules(), auth, catalogs);
    }

    @Test
    void deniesUpdatesToAnotherOrganizersEvent() {
        when(repository.find(10, true))
                .thenReturn(Optional.of(EventFixtures.event(8, EventStatus.DRAFT)));
        var error =
                assertThrows(
                        ApiException.class,
                        () -> service.update(organizer, 10, EventFixtures.content()));
        assertEquals(404, error.status);
        verify(repository, never()).update(any(), any());
    }

    @Test
    void publicationDoesNotWriteOnVersionConflict() {
        when(repository.find(10, true))
                .thenReturn(Optional.of(EventFixtures.event(7, EventStatus.DRAFT)));
        assertEquals(
                409,
                assertThrows(ApiException.class, () -> service.publish(organizer, 10, 2)).status);
        verify(repository, never()).publish(any());
    }

    @Test
    void repeatedPublicationKeepsExistingPublishedTimeAndVersion() {
        var published = EventFixtures.event(7, EventStatus.PUBLISHED);
        when(repository.find(10, true)).thenReturn(Optional.of(published));
        assertSame(published, service.publish(organizer, 10, 1));
        verify(repository, never()).publish(any());
    }

    @Test
    void publicationChecksPersistedReferencesBeforeWriting() {
        when(repository.find(10, true))
                .thenReturn(Optional.of(EventFixtures.event(7, EventStatus.DRAFT)));
        when(catalogs.organizationUnitExists(1)).thenReturn(false);
        assertEquals(
                "INVALID_UNIT",
                assertThrows(ApiException.class, () -> service.publish(organizer, 10, 1)).code);
        verify(repository, never()).publish(any());
    }

    @Test
    void revokedActorCannotStartAnEventWrite() {
        doThrow(new ApiException(401, "UNAUTHENTICATED", "Expired"))
                .when(auth)
                .requireActiveOrganizer(organizer);
        assertEquals(
                401,
                assertThrows(
                                ApiException.class,
                                () -> service.create(organizer, EventFixtures.content()))
                        .status);
        verifyNoInteractions(repository);
    }
}
