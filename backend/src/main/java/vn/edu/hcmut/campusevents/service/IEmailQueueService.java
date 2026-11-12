package vn.edu.hcmut.campusevents.service;

import vn.edu.hcmut.campusevents.model.Event;
import vn.edu.hcmut.campusevents.model.Registration;

public interface IEmailQueueService {
    void registration(Event event, Registration registration, String kind);

    void eventChanged(Event before, Event after);
}
