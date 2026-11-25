package vn.edu.hcmut.campusevents.controller;

import org.junit.jupiter.api.Test;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;
import vn.edu.hcmut.campusevents.service.IEnvironmentService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EnvironmentControllerTest {
    @Test void platformProbeWaitsForReadinessWithoutQueryingTheDatabase() {
        var environment = mock(IEnvironmentService.class);
        var availability = mock(ApplicationAvailability.class);
        var controller = new EnvironmentController(environment, availability);
        when(availability.getReadinessState()).thenReturn(ReadinessState.REFUSING_TRAFFIC);
        assertEquals(503, controller.live().getStatusCode().value());
        when(availability.getReadinessState()).thenReturn(ReadinessState.ACCEPTING_TRAFFIC);
        assertEquals(200, controller.live().getStatusCode().value());
        verifyNoInteractions(environment);
    }
}
