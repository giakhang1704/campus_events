package vn.edu.hcmut.campusevents.service;

import vn.edu.hcmut.campusevents.model.OutboxMessage;

import java.util.Optional;

public interface IEmailOutboxService {
    Optional<OutboxMessage> claim();

    boolean current(OutboxMessage message);

    void sent(OutboxMessage message, String providerId);

    void failed(OutboxMessage message, String reason, boolean retry);
}
