package vn.edu.hcmut.campusevents.dto.event;

import jakarta.validation.constraints.*;

import vn.edu.hcmut.campusevents.model.EventContent;

import java.time.OffsetDateTime;
import java.util.List;

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
    public EventContent toContent() {
        return new EventContent(
                title,
                description,
                location,
                organizationUnitId,
                registrationOpensAt,
                registrationClosesAt,
                startsAt,
                endsAt,
                capacity,
                departmentIds,
                studyYears,
                version);
    }
}
