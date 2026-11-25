package vn.edu.hcmut.campusevents.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.hcmut.campusevents.config.MailSettings;
import vn.edu.hcmut.campusevents.model.OutboxMessage;
import vn.edu.hcmut.campusevents.repository.IEmailOutboxRepository;
import vn.edu.hcmut.campusevents.service.IEmailOutboxService;

import java.util.Optional;

@Service
public class EmailOutboxServiceImpl implements IEmailOutboxService {
    private final IEmailOutboxRepository outbox;
    private final MailSettings settings;

    public EmailOutboxServiceImpl(IEmailOutboxRepository outbox, MailSettings settings) {
        this.outbox = outbox;
        this.settings = settings;
    }

    @Override
    @Transactional
    public Optional<OutboxMessage> claim() {
        return outbox.claim(settings.maxAttempts());
    }

    @Override
    @Transactional(readOnly = true)
    public boolean current(OutboxMessage m) {
        return outbox.current(m);
    }

    @Override
    @Transactional
    public void sent(OutboxMessage m, String id) {
        outbox.sent(m, id);
    }

    @Override
    @Transactional
    public void failed(OutboxMessage m, String reason, boolean retry) {
        outbox.failed(m, reason, retry);
    }
}
