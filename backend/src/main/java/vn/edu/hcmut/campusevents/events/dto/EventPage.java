package vn.edu.hcmut.campusevents.events.dto;

import java.util.List;
import vn.edu.hcmut.campusevents.events.model.Event;

public record EventPage(List<Event> items, int page, int size, boolean hasNext) {
    public EventPage {
        items = List.copyOf(items);
    }
}
