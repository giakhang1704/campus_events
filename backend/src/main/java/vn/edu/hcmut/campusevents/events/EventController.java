package vn.edu.hcmut.campusevents.events;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import vn.edu.hcmut.campusevents.auth.AuthPrincipal;
import vn.edu.hcmut.campusevents.events.dto.EventPage;
import vn.edu.hcmut.campusevents.events.dto.EventRequest;
import vn.edu.hcmut.campusevents.events.dto.PublishRequest;
import vn.edu.hcmut.campusevents.events.model.Event;

@RestController
@Validated
@RequestMapping("/api")
public class EventController {
    private final EventService events;

    public EventController(EventService events) {
        this.events = events;
    }

    @GetMapping("/events")
    public EventPage listPublished(
            @RequestParam(defaultValue = "") @Size(max = 100) String q,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        return events.listPublished(q, page, size);
    }

    @GetMapping("/events/{id}")
    public Event getPublished(@PathVariable @Positive long id) {
        return events.getPublished(id);
    }

    @GetMapping("/organizer/events")
    public EventPage list(@AuthenticationPrincipal AuthPrincipal actor,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        return events.listOwned(actor, page, size);
    }

    @GetMapping("/organizer/events/{id}")
    public Event get(@AuthenticationPrincipal AuthPrincipal actor, @PathVariable long id) {
        return events.getOwned(actor, id);
    }

    @PostMapping("/events")
    public ResponseEntity<Event> create(@AuthenticationPrincipal AuthPrincipal actor,
            @Valid @RequestBody EventRequest request) {
        return ResponseEntity.status(201).body(events.create(actor, request));
    }

    @PatchMapping("/events/{id}")
    public Event update(@AuthenticationPrincipal AuthPrincipal actor, @PathVariable long id,
            @Valid @RequestBody EventRequest request) {
        return events.update(actor, id, request);
    }

    @PostMapping("/events/{id}/publish")
    public Event publish(@AuthenticationPrincipal AuthPrincipal actor, @PathVariable long id,
            @Valid @RequestBody PublishRequest request) {
        return events.publish(actor, id, request.version());
    }
}
