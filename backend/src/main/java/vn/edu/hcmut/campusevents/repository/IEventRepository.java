package vn.edu.hcmut.campusevents.repository;

import vn.edu.hcmut.campusevents.model.Event;
import vn.edu.hcmut.campusevents.model.EventContent;

import java.util.List;
import java.util.Optional;

public interface IEventRepository {
    Optional<Event> find(long id, boolean forUpdate);

    Optional<Event> findPublished(long id);

    List<Event> listPublished(String query, int page, int size);

    List<Event> listOwned(long organizerId, int page, int size);

    long insert(long organizerId, EventContent content);

    boolean update(Event before, EventContent content);

    boolean publish(Event before);

    int countParticipants(long eventId, String status);

    boolean hasUnfinishedEvents(long organizerId);
}
