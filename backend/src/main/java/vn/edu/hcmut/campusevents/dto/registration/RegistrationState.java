package vn.edu.hcmut.campusevents.dto.registration;

public record RegistrationState(
        long eventId,
        RegistrationResponse registration,
        boolean eligible,
        boolean registrationOpen,
        int registeredCount,
        int waitingCount,
        int availableSeats) {}
