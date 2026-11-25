package vn.edu.hcmut.campusevents.dto.event;

import java.util.List;

public record EventPageResponse(List<EventResponse> items, int page, int size, boolean hasNext) {
    public EventPageResponse {
        items = List.copyOf(items);
    }
}
