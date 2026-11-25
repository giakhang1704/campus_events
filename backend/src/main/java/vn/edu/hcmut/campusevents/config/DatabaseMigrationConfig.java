package vn.edu.hcmut.campusevents.config;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;

@Configuration
public class DatabaseMigrationConfig {
    @Bean
    FlywayMigrationStrategy databaseMigrationStrategy(
            @Value("${campus.database.baseline-existing:false}") boolean adoptExisting) {
        return flyway -> migrate(flyway, adoptExisting);
    }

    /** Existing installations require an explicit, one-time opt-in after a backup. Never reset data. */
    public static void migrate(Flyway flyway, boolean adoptExisting) {
        try (var connection = flyway.getConfiguration().getDataSource().getConnection()) {
            boolean history;
            try (var statement = connection.createStatement();
                    var rs = statement.executeQuery("SELECT to_regclass('campus.flyway_schema_history') IS NOT NULL")) {
                rs.next(); history = rs.getBoolean(1);
            }
            Set<String> actual = new HashSet<>();
            try (var statement = connection.createStatement(); var rs = statement.executeQuery("""
                    SELECT c.table_name || '.' || c.column_name
                    FROM information_schema.columns c JOIN information_schema.tables t
                    USING(table_catalog,table_schema,table_name)
                    WHERE c.table_schema='campus' AND t.table_type='BASE TABLE'
                    """)) {
                while (rs.next()) actual.add(rs.getString(1));
            }
            if (!history && !actual.isEmpty()) {
                if (!adoptExisting) throw new IllegalStateException(
                        "Existing campus schema has no migration history. Back up first, then set DB_BASELINE_EXISTING=true once.");
                Set<String> expected = new HashSet<>(new ClassPathResource("db/legacy-columns.txt")
                        .getContentAsString(StandardCharsets.UTF_8).lines().filter(s -> !s.isBlank()).toList());
                if (!actual.equals(expected)) throw new IllegalStateException(
                        "Legacy schema does not match the supported I3 table/column layout; baseline refused. No data was reset.");
                // Flyway's baseline command takes its own database lock; migration checksums apply from V2 onwards.
                flyway.baseline();
            }
        } catch (SQLException | java.io.IOException e) {
            throw new IllegalStateException("Database migration preflight failed", e);
        }
        flyway.migrate();
    }
}
