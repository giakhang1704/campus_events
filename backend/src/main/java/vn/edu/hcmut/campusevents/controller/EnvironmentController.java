package vn.edu.hcmut.campusevents.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.hcmut.campusevents.service.IEnvironmentService;

import java.util.Map;

@RestController
public class EnvironmentController {
    private final IEnvironmentService environment;
    private final ApplicationAvailability availability;

    public EnvironmentController(IEnvironmentService environment, ApplicationAvailability availability) {
        this.environment = environment;
        this.availability = availability;
    }

    /** Platform probes must not repeatedly wake a sleeping database. /api/health still checks data. */
    @GetMapping("/api/live")
    public ResponseEntity<Map<String, Object>> live() {
        boolean ready = availability.getReadinessState() == ReadinessState.ACCEPTING_TRAFFIC;
        return ResponseEntity.status(ready ? 200 : 503).body(Map.of("status", ready ? "UP" : "STARTING"));
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        var result = environment.health();
        return ResponseEntity.status(result.httpStatus()).body(result.body());
    }
}
