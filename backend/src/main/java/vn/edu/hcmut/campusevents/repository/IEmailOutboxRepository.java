package vn.edu.hcmut.campusevents.repository;

import vn.edu.hcmut.campusevents.model.*;

import java.util.Map;
import java.util.Optional;

public interface IEmailOutboxRepository {
    void enqueue(
            Event event,
            Registration registration,
            String recipient,
            String kind,
            Map<String, Object> payload);

    Optional<OutboxMessage> claim(int maxAttempts);

    boolean current(OutboxMessage message);

    void sent(OutboxMessage message, String providerId);

    void failed(OutboxMessage message, String reason, boolean retry);
}
