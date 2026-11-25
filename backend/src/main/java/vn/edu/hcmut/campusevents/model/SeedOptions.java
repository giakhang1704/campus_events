package vn.edu.hcmut.campusevents.model;

/** Runtime-only configuration. Never log passwords or commit their values. */
public record SeedOptions(
        boolean bootstrap,
        String bootstrapEmail,
        String bootstrapPassword,
        boolean development,
        String developmentPassword) {}
