package vn.edu.hcmut.campusevents.events.dto;

import java.time.OffsetDateTime;
import java.util.List;
import jakarta.validation.constraints.*;
import vn.edu.hcmut.campusevents.events.model.Event;

/** Complete event content; version is additionally required when updating. */
public record EventRequest(
        @NotBlank @Size(max = 250) String title,
        @NotBlank @Size(max = 20000) String description,
        @NotBlank @Size(max = 250) String location,
        @NotNull @Positive Long organizationUnitId,
        @NotNull OffsetDateTime registrationOpensAt,
        @NotNull OffsetDateTime registrationClosesAt,
        @NotNull OffsetDateTime startsAt,
        @NotNull OffsetDateTime endsAt,
        @NotNull @Positive Integer capacity,
        @NotNull @Size(max = 200) List<@NotNull @Positive Long> departmentIds,
        @NotNull @Size(max = 200) List<@NotNull @Min(1) @Max(32767) Integer> studyYears,
        @Positive Integer version) {
    public static EventRequest from(Event event) {
        return new EventRequest(event.title(), event.description(), event.location(), event.organizationUnitId(),
                event.registrationOpensAt(), event.registrationClosesAt(), event.startsAt(), event.endsAt(),
                event.capacity(), event.departmentIds(), event.studyYears(), event.version());
    }
}
