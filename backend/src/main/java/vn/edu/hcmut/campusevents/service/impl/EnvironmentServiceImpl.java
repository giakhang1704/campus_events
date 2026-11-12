package vn.edu.hcmut.campusevents.service.impl;

import org.springframework.stereotype.Service;

import vn.edu.hcmut.campusevents.model.EnvironmentHealth;
import vn.edu.hcmut.campusevents.repository.IEnvironmentRepository;
import vn.edu.hcmut.campusevents.service.IEnvironmentService;

import java.util.Map;

@Service
public class EnvironmentServiceImpl implements IEnvironmentService {
    private final IEnvironmentRepository environment;

    public EnvironmentServiceImpl(IEnvironmentRepository environment) {
        this.environment = environment;
    }

    @Override
    public EnvironmentHealth health() {
        try {
            int tables = environment.countTables();
            if (tables != 15)
                return new EnvironmentHealth(
                        503,
                        Map.of(
                                "status",
                                "NOT_READY",
                                "database",
                                "CONNECTED",
                                "schema",
                                "MISSING_OR_INCOMPLETE"));
            environment.checkEventsReadable();
            return new EnvironmentHealth(
                    200,
                    Map.of(
                            "status",
                            "UP",
                            "database",
                            "CONNECTED",
                            "schema",
                            "campus",
                            "tables",
                            tables));
        } catch (Exception error) {
            return new EnvironmentHealth(503, Map.of("status", "DOWN", "database", "UNAVAILABLE"));
        }
    }
}
