package vn.edu.hcmut.campusevents;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in full I3 and backup rehearsal: -Ppostgres-it -Dtest=NativeSystemCheck.
 * Requires PostgreSQL 17+ client tools at POSTGRES_CLIENT_BIN. No installed service or Docker required. */
class NativeSystemCheck {
    private final Path root = Path.of("..").toAbsolutePath().normalize();
    private final Map<String, String> environment = new HashMap<>();
    private Path restartRequest;
    private Runnable restarter;

    private int run(String... command) throws Exception {
        Path log = Files.createTempFile(root.resolve("backend/target"), "native-step-", ".log");
        var builder = new ProcessBuilder(command).directory(root.toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().putAll(environment);
        var process = builder.start();
        long deadline = System.nanoTime() + TimeUnit.MINUTES.toNanos(5);
        try {
            while (!process.waitFor(200, TimeUnit.MILLISECONDS)) {
                Path acknowledged = restartRequest == null ? null : restartRequest.resolveSibling(restartRequest.getFileName().toString().replace(".request", ".done"));
                if (restarter != null && Files.exists(restartRequest) && !Files.exists(acknowledged)) {
                    restarter.run();
                    Files.writeString(acknowledged, "ready");
                }
                if (System.nanoTime() > deadline) fail("Native system check timed out");
            }
        } finally {
            if (process.isAlive()) process.destroyForcibly();
            System.out.print(new String(Files.readAllBytes(log), java.nio.charset.StandardCharsets.UTF_8));
        }
        return process.exitValue();
    }

    @Test void fullI3AndBackupRestoreOnIsolatedPostgres() throws Exception {
        String configured = Objects.requireNonNull(System.getenv("POSTGRES_CLIENT_BIN"), "Set POSTGRES_CLIENT_BIN");
        Path tools = Path.of(configured).toAbsolutePath().normalize();
        String executable = System.getProperty("os.name").startsWith("Windows") ? ".exe" : "";
        assertTrue(Files.isRegularFile(tools.resolve("psql" + executable)));
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String name = "campus_test_native_" + suffix;
        String password = "Test_" + UUID.randomUUID();
        byte[] key = new byte[32]; new java.security.SecureRandom().nextBytes(key);
        try (var pg = EmbeddedPostgres.builder().setPort(0).setServerConfig("listen_addresses", "127.0.0.1").start()) {
            new JdbcTemplate(pg.getPostgresDatabase()).execute("CREATE DATABASE " + name);
            environment.put("PATH", tools + java.io.File.pathSeparator + System.getenv("PATH"));
            environment.put("PGHOST", "127.0.0.1");
            environment.put("PGPORT", Integer.toString(pg.getPort()));
            environment.put("PGUSER", "postgres"); environment.put("PGPASSWORD", "postgres");
            environment.put("PGDATABASE", name); environment.put("PGCLIENTENCODING", "UTF8");
            environment.put("TEST_NATIVE_PSQL", tools.resolve("psql" + executable).toString());
            environment.put("TEST_ACCOUNT_PASSWORD", password);
            environment.put("PYTHONPATH", root.resolve("scripts/smoke").toString());
            String[] args = {
                    "--server.port=0", "--spring.datasource.url=" + pg.getJdbcUrl("postgres", name),
                    "--spring.datasource.username=postgres", "--spring.datasource.password=postgres",
                    "--campus.dev-seed.enabled=true", "--campus.dev-seed.password=" + password,
                    "--campus.auth.rate-limit.enabled=false", "--campus.mail.enabled=false",
                    "--campus.attendance.token-key=" + Base64.getEncoder().encodeToString(key)};
            try (var app = new SpringApplicationBuilder(CampusEventsApplication.class).run(args)) {
                int port = ((ServletWebServerApplicationContext) app).getWebServer().getPort();
                environment.put("I1_API_BASE", "http://127.0.0.1:" + port + "/api");
                restartRequest = root.resolve("backend/target/native-restart-" + suffix + ".request");
                environment.put("TEST_NATIVE_RESTART_REQUEST", restartRequest.toString());
                var current = new java.util.concurrent.atomic.AtomicReference<org.springframework.context.ConfigurableApplicationContext>(app);
                restarter = () -> {
                    current.get().close();
                    String[] restartedArgs = args.clone(); restartedArgs[0] = "--server.port=" + port;
                    current.set(new SpringApplicationBuilder(CampusEventsApplication.class).run(restartedArgs));
                };
                try { assertEquals(0, run("python", "scripts/smoke/i3_http.py")); }
                finally { restarter = null; current.get().close(); }
                String unit = "Đơn vị O'Reilly " + suffix;
                for (int i = 0; i < 2; i++) assertEquals(0, run("python", "scripts/seed-catalog.py", "--unit-name", unit));
                var jdbc = new JdbcTemplate(pg.getDatabase("postgres", name));
                assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM campus.organization_units WHERE name=?", Integer.class, unit));
                assertNotEquals(0, run("python", "scripts/seed-catalog.py", "--unit-name", " "));
                Path dump = root.resolve("backend/target/native-system-" + suffix + ".dump");
                assertEquals(0, run("python", "scripts/database-backup.py", "backup", "--output", dump.toString()));
                assertNotEquals(0, run("python", "scripts/database-backup.py", "backup", "--output", dump.toString()));
                String restored = "bkevent_restore_" + suffix;
                assertEquals(0, run("python", "scripts/database-backup.py", "restore", "--input", dump.toString(), "--target-db", restored));
                assertNotEquals(0, run("python", "scripts/database-backup.py", "restore", "--input", dump.toString(), "--target-db", restored));
                var copy = new JdbcTemplate(pg.getDatabase("postgres", restored));
                for (String table : List.of("users", "auth_sessions", "events", "registrations", "attendance", "attendance_history", "email_outbox", "flyway_schema_history")) {
                    assertEquals(jdbc.queryForObject("SELECT count(*) FROM campus." + table, Long.class),
                            copy.queryForObject("SELECT count(*) FROM campus." + table, Long.class), table);
                }
                copy.update("INSERT INTO campus.organization_units(name) VALUES ('Sequence after restore')");
                // Start the restored schema through Flyway, then prove login and CSV still work.
                try (var recovered = new SpringApplicationBuilder(CampusEventsApplication.class).run(
                        "--server.port=0", "--spring.datasource.url=" + pg.getJdbcUrl("postgres", restored),
                        "--spring.datasource.username=postgres", "--spring.datasource.password=postgres",
                        "--campus.dev-seed.enabled=false", "--campus.mail.enabled=false",
                        "--campus.attendance.token-key=" + Base64.getEncoder().encodeToString(key))) {
                    environment.put("I1_API_BASE", "http://127.0.0.1:" + ((ServletWebServerApplicationContext) recovered).getWebServer().getPort() + "/api");
                    assertEquals(0, run("python", "-c", "from i1_http import Client,BASE; c=Client(); c.login('organizer.i1@example.test'); events=c.call('GET','/organizer/events?size=100')['items']; e=next(e for e in events if e['status']=='PUBLISHED' and e['capacity']<10000); data=c.opener.open(BASE+'/organizer/events/'+str(e['id'])+'/report.csv').read(); assert data.startswith(bytes([239,187,191])); print('PASS restored database: login and CSV')"));
                }
                System.out.println("PASS native PostgreSQL: I3, catalog validation, backup/restore, duplicate target guards, restored app and sequence");
            }
        }
    }
}
