package vn.edu.hcmut.campusevents.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import vn.edu.hcmut.campusevents.exception.EmailDeliveryException;
import vn.edu.hcmut.campusevents.service.IEmailOutboxService;
import vn.edu.hcmut.campusevents.service.IEmailSender;

import java.util.Locale;

@Configuration
@EnableScheduling
public class EmailDispatcher {
    private static final Logger LOG = LoggerFactory.getLogger(EmailDispatcher.class);
    private final MailSettings settings;
    private final IEmailOutboxService outbox;
    private final IEmailSender sender;

    public EmailDispatcher(MailSettings settings, IEmailOutboxService outbox, IEmailSender sender) {
        this.settings = settings;
        this.outbox = outbox;
        this.sender = sender;
    }

    @Scheduled(
            fixedDelayString = "${campus.mail.poll-ms:5000}",
            initialDelayString = "${campus.mail.initial-delay-ms:10000}")
    public void dispatch() {
        if (!settings.enabled()) return;
        try {
            for (int i = 0; i < 20; i++) {
                var claimed = outbox.claim();
                if (claimed.isEmpty()) break;
                var message = claimed.get();
                if (!outbox.current(message)) {
                    outbox.failed(message, "STALE_REGISTRATION", false);
                    continue;
                }
                String domain =
                        message.recipient()
                                .substring(message.recipient().lastIndexOf('@') + 1)
                                .toLowerCase(Locale.ROOT);
                if (!settings.allowTestRecipients()
                        && (domain.endsWith(".test")
                                || domain.endsWith(".invalid")
                                || domain.endsWith(".example")
                                || domain.equals("example.com")
                                || domain.equals("example.org")
                                || domain.equals("example.net")
                                || domain.endsWith(".example.com")
                                || domain.endsWith(".example.org")
                                || domain.endsWith(".example.net")
                                || domain.endsWith(".localhost")
                                || domain.endsWith(".local"))) {
                    outbox.failed(message, "RESERVED_TEST_RECIPIENT", false);
                    continue;
                }
                try {
                    outbox.sent(message, sender.send(message));
                } catch (EmailDeliveryException error) {
                    outbox.failed(message, error.getMessage(), error.retryable());
                }
            }
        } catch (Exception error) {
            LOG.warn(
                    "Email dispatch interrupted; pending rows remain durable and leases recover"
                            + " automatically.");
        }
    }
}
