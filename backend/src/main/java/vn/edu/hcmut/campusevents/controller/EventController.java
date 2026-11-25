package vn.edu.hcmut.campusevents.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import vn.edu.hcmut.campusevents.dto.event.EventPageResponse;
import vn.edu.hcmut.campusevents.dto.event.EventRequest;
import vn.edu.hcmut.campusevents.dto.event.EventResponse;
import vn.edu.hcmut.campusevents.dto.event.PublishEventRequest;
import vn.edu.hcmut.campusevents.mapper.EventMapper;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;
import vn.edu.hcmut.campusevents.service.IEventService;

@RestController
@Validated
@RequestMapping("/api")
public class EventController {
    private final IEventService events;

    public EventController(IEventService events) {
        this.events = events;
    }

    @GetMapping("/events")
    public EventPageResponse listPublished(
            @RequestParam(defaultValue = "") @Size(max = 100) String q,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        return events.listPublished(q, page, size);
    }

    @GetMapping("/events/{id}")
    public EventResponse getPublished(@PathVariable @Positive long id) {
        return EventMapper.toResponse(events.getPublished(id));
    }

    @GetMapping("/organizer/events")
    public EventPageResponse list(
            @AuthenticationPrincipal AuthPrincipal actor,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        return events.listOwned(actor, page, size);
    }

    @GetMapping("/organizer/events/{id}")
    public EventResponse get(@AuthenticationPrincipal AuthPrincipal actor, @PathVariable long id) {
        return EventMapper.toResponse(events.getOwned(actor, id));
    }

    @PostMapping("/events")
    public ResponseEntity<EventResponse> create(
            @AuthenticationPrincipal AuthPrincipal actor,
            @Valid @RequestBody EventRequest request) {
        return ResponseEntity.status(201)
                .body(EventMapper.toResponse(events.create(actor, request.toContent())));
    }

    @PatchMapping("/events/{id}")
    public EventResponse update(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable long id,
            @Valid @RequestBody EventRequest request) {
        return EventMapper.toResponse(events.update(actor, id, request.toContent()));
    }

    @PostMapping("/events/{id}/publish")
    public EventResponse publish(
            @AuthenticationPrincipal AuthPrincipal actor,
            @PathVariable long id,
            @Valid @RequestBody PublishEventRequest request) {
        return EventMapper.toResponse(events.publish(actor, id, request.version()));
    }
}
