package vn.edu.hcmut.campusevents;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.edu.hcmut.campusevents.config.DatabaseMigrationConfig;
import vn.edu.hcmut.campusevents.repository.jdbc.JdbcEnvironmentRepository;
import javax.sql.DataSource;
import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;

/** Actual PostgreSQL 17 in an isolated temporary directory, without Docker or development data. */
class DatabaseMigrationIT {
    static EmbeddedPostgres postgres;
    DataSource data;
    JdbcTemplate jdbc;
    Flyway flyway;

    @BeforeAll static void start() throws Exception {
        postgres = EmbeddedPostgres.builder().setPort(0)
                .setServerConfig("listen_addresses", "127.0.0.1").start();
    }
    @AfterAll static void stop() throws Exception { if (postgres != null) postgres.close(); }
    @BeforeEach void database() throws Exception {
        String name = "migration_" + java.util.UUID.randomUUID().toString().replace("-", "");
        new JdbcTemplate(postgres.getPostgresDatabase()).execute("CREATE DATABASE " + name);
        data = postgres.getDatabase("postgres", name);
        jdbc = new JdbcTemplate(data);
        flyway = Flyway.configure().dataSource(data).schemas("campus").defaultSchema("campus")
                .cleanDisabled(true).load();
    }

    private void legacy() throws Exception {
        jdbc.execute(Files.readString(Path.of("../database/schema/01_schema.sql")));
        jdbc.update("INSERT INTO campus.organization_units(name) VALUES ('Keep this unit')");
    }

    @Test void emptyDatabaseMigratesAndRestartIsIdempotent() {
        DatabaseMigrationConfig.migrate(flyway, false);
        assertEquals(15, new JdbcEnvironmentRepository(jdbc).countTables());
        assertEquals("2", flyway.info().current().getVersion().getVersion());
        jdbc.update("INSERT INTO campus.organization_units(name) VALUES ('Keep this unit')");
        DatabaseMigrationConfig.migrate(flyway, false);
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM campus.organization_units", Integer.class));
        assertThrows(Exception.class, flyway::clean);
    }

    @Test void legacyRequiresExplicitOptInAndKeepsDataAndIdentity() throws Exception {
        legacy();
        assertThrows(IllegalStateException.class, () -> DatabaseMigrationConfig.migrate(flyway, false));
        assertNull(jdbc.queryForObject("SELECT to_regclass('campus.flyway_schema_history')::text", String.class));
        DatabaseMigrationConfig.migrate(flyway, true);
        assertEquals("Keep this unit", jdbc.queryForObject("SELECT name FROM campus.organization_units WHERE id=1", String.class));
        assertEquals("2", flyway.info().current().getVersion().getVersion());
        assertEquals(15, new JdbcEnvironmentRepository(jdbc).countTables());
    }

    @Test void partialLegacySchemaIsRejectedWithoutChangingIt() throws Exception {
        legacy();
        jdbc.execute("ALTER TABLE campus.organization_units DROP COLUMN name");
        assertThrows(IllegalStateException.class, () -> DatabaseMigrationConfig.migrate(flyway, true));
        assertNull(jdbc.queryForObject("SELECT to_regclass('campus.flyway_schema_history')::text", String.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM campus.organization_units", Integer.class));
    }

    @Test void modifiedMigrationChecksumStopsStartup() {
        DatabaseMigrationConfig.migrate(flyway, false);
        jdbc.update("UPDATE campus.flyway_schema_history SET checksum=123 WHERE version='2'");
        assertThrows(Exception.class, () -> DatabaseMigrationConfig.migrate(flyway, false));
    }
}
