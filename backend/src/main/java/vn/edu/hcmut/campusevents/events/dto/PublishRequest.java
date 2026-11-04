package vn.edu.hcmut.campusevents.events.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record PublishRequest(@NotNull @Positive Integer version) {
}
