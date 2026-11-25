package vn.edu.hcmut.campusevents.service;

import vn.edu.hcmut.campusevents.dto.event.EventPageResponse;
import vn.edu.hcmut.campusevents.model.Event;
import vn.edu.hcmut.campusevents.model.EventContent;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;

public interface IEventService {
    EventPageResponse listPublished(String query, int page, int size);

    Event getPublished(long id);

    EventPageResponse listOwned(AuthPrincipal actor, int page, int size);

    Event getOwned(AuthPrincipal actor, long id);

    Event create(AuthPrincipal actor, EventContent content);

    Event update(AuthPrincipal actor, long id, EventContent content);

    Event publish(AuthPrincipal actor, long id, int version);
}
