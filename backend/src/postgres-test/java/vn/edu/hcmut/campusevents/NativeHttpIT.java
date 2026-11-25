package vn.edu.hcmut.campusevents;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import static org.junit.jupiter.api.Assertions.*;

class NativeHttpIT {
    private final ObjectMapper json = new ObjectMapper();
    private final java.util.Map<String, String> cookies = new java.util.LinkedHashMap<>();
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10)).build();
    private String base;
    private String csrf;

    private HttpResponse<String> call(String method, String path, String body, int expected) throws Exception {
        if (!method.equals("GET")) {
            csrf = json.readTree(call("GET", "/auth/csrf", null, 200).body()).path("token").asText();
            assertEquals(csrf, cookies.get("XSRF-TOKEN"), "CSRF response and cookie must agree");
        }
        var request = HttpRequest.newBuilder(URI.create(base + path)).timeout(Duration.ofSeconds(20));
        if (!cookies.isEmpty()) request.header("Cookie", cookies.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + entry.getValue()).collect(java.util.stream.Collectors.joining("; ")));
        if (!method.equals("GET")) request.header("X-XSRF-TOKEN", csrf).header("Content-Type", "application/json");
        var response = client.send(request.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
        for (String header : response.headers().allValues("Set-Cookie")) {
            for (var cookie : HttpCookie.parse(header)) {
                if (cookie.getMaxAge() == 0) cookies.remove(cookie.getName());
                else cookies.put(cookie.getName(), cookie.getValue());
            }
        }
        assertEquals(expected, response.statusCode(), () -> method + " " + path + ": " + response.body());
        return response;
    }

    @Test void realStartupCatalogSessionsCsrfAndRateLimit() throws Exception {
        try (var pg = EmbeddedPostgres.builder().setPort(0).setServerConfig("listen_addresses", "127.0.0.1").start()) {
            String password = "Test_" + java.util.UUID.randomUUID();
            try (var app = new SpringApplicationBuilder(CampusEventsApplication.class).run(
                    "--server.port=0", "--spring.datasource.url=" + pg.getJdbcUrl("postgres", "postgres"),
                    "--spring.datasource.username=postgres", "--spring.datasource.password=postgres",
                    "--campus.bootstrap.enabled=true", "--campus.bootstrap.email=admin@example.test",
                    "--campus.bootstrap.password=" + password, "--campus.dev-seed.enabled=false",
                    "--campus.auth.rate-limit.login-account=2", "--campus.auth.rate-limit.register-ip=2",
                    "--campus.mail.enabled=false")) {
                base = "http://127.0.0.1:" + ((ServletWebServerApplicationContext) app).getWebServer().getPort() + "/api";
                assertEquals("UP", json.readTree(call("GET", "/health", null, 200).body()).path("status").asText());
                call("GET", "/live", null, 200);
                assertEquals(12, json.readTree(call("GET", "/catalog/departments", null, 200).body()).size());
                assertEquals(0, json.readTree(call("GET", "/catalog/organization-units", null, 200).body()).size());
                var jdbc = new JdbcTemplate(pg.getPostgresDatabase());
                assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM campus.users", Integer.class));
                assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM campus.events", Integer.class));
                call("GET", "/admin/users", null, 401);
                csrf = json.readTree(call("GET", "/auth/csrf", null, 200).body()).path("token").asText();
                String credentials = json.writeValueAsString(java.util.Map.of("email", "admin@example.test", "password", password));
                // Successful login resets the account bucket, so legitimate logouts don't lock the account.
                call("POST", "/auth/login", credentials, 200);
                csrf = json.readTree(call("GET", "/auth/csrf", null, 200).body()).path("token").asText();
                call("GET", "/auth/me", null, 200);
                call("POST", "/auth/logout", null, 204);
                call("GET", "/auth/me", null, 401);
                csrf = json.readTree(call("GET", "/auth/csrf", null, 200).body()).path("token").asText();
                String wrong = "{\"email\":\"admin@example.test\",\"password\":\"wrong-password\"}";
                call("POST", "/auth/login", wrong, 401);
                call("POST", "/auth/login", wrong, 401);
                var limited = call("POST", "/auth/login", wrong, 429);
                assertEquals("RATE_LIMITED", json.readTree(limited.body()).path("code").asText());
                assertTrue(Long.parseLong(limited.headers().firstValue("Retry-After").orElseThrow()) > 0);
                assertFalse(limited.body().contains("password_hash"));
            }
        }
    }
}
