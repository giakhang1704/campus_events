package vn.edu.hcmut.campusevents.config;

import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;

import vn.edu.hcmut.campusevents.exception.EmailDeliveryException;
import vn.edu.hcmut.campusevents.model.OutboxMessage;
import vn.edu.hcmut.campusevents.service.*;

import java.time.OffsetDateTime;
import java.util.Optional;

class EmailDispatcherTest {
    private final IEmailOutboxService outbox = mock(IEmailOutboxService.class);
    private final IEmailSender sender = mock(IEmailSender.class);
    private final OutboxMessage message =
            new OutboxMessage(
                    1,
                    1,
                    "student@example.test",
                    "REGISTRATION_CONFIRMED",
                    "key",
                    "{}",
                    1,
                    OffsetDateTime.now());

    private EmailDispatcher dispatcher(boolean enabled, boolean allowTests) {
        return new EmailDispatcher(
                new MailSettings(
                        enabled,
                        "test-key",
                        "sender@example.test",
                        "Test",
                        "http://localhost",
                        5,
                        allowTests),
                outbox,
                sender);
    }

    private void claim(boolean current) {
        when(outbox.claim()).thenReturn(Optional.of(message), Optional.empty());
        when(outbox.current(message)).thenReturn(current);
    }

    @Test
    void disabledByDefaultDoesNotClaimOrSend() {
        dispatcher(false, false).dispatch();
        verifyNoInteractions(outbox, sender);
    }

    @Test
    void staleRegistrationNeverReachesProvider() {
        claim(false);
        dispatcher(true, true).dispatch();
        verify(outbox).failed(message, "STALE_REGISTRATION", false);
        verifyNoInteractions(sender);
    }

    @Test
    void fixtureDomainsAreBlockedInNormalMode() {
        claim(true);
        dispatcher(true, false).dispatch();
        verify(outbox).failed(message, "RESERVED_TEST_RECIPIENT", false);
        verifyNoInteractions(sender);
    }

    @Test
    void recordsProviderAcceptance() {
        claim(true);
        when(sender.send(message)).thenReturn("provider-id");
        dispatcher(true, true).dispatch();
        verify(outbox).sent(message, "provider-id");
    }

    @Test
    void propagatesOnlySanitizedRetryableFailure() {
        claim(true);
        when(sender.send(message)).thenThrow(new EmailDeliveryException("BREVO_HTTP_503", true));
        dispatcher(true, true).dispatch();
        verify(outbox).failed(message, "BREVO_HTTP_503", true);
        verify(outbox, never()).sent(any(), any());
    }
}
