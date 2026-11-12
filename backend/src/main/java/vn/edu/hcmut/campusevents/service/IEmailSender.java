package vn.edu.hcmut.campusevents.service;

import vn.edu.hcmut.campusevents.model.OutboxMessage;

public interface IEmailSender {
    String send(OutboxMessage message);
}
