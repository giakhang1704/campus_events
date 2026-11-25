package vn.edu.hcmut.campusevents.model;

import java.util.Map;

public record EnvironmentHealth(int httpStatus, Map<String, Object> body) {}
