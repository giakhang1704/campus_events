package vn.edu.hcmut.campusevents.dto.registration;

import java.util.List;

public record ParticipantPage(
        List<ParticipantResponse> items,
        int page,
        int size,
        boolean hasNext,
        int registeredCount,
        int waitingCount,
        int capacity) {}
