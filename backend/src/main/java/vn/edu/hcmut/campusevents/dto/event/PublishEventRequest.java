package vn.edu.hcmut.campusevents.dto.event;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record PublishEventRequest(@NotNull @Positive Integer version) {}
