package vn.edu.hcmut.campusevents.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.hcmut.campusevents.service.IEnvironmentService;

import java.util.Map;

@RestController
public class EnvironmentController {
    private final IEnvironmentService environment;

    public EnvironmentController(IEnvironmentService environment) {
        this.environment = environment;
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        var result = environment.health();
        return ResponseEntity.status(result.httpStatus()).body(result.body());
    }
}
