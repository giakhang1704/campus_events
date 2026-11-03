package vn.edu.hcmut.campusevents.common;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
@RestController
public class EnvironmentController {
 private final JdbcTemplate jdbc;
 public EnvironmentController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
 @GetMapping("/api/health")
 public ResponseEntity<Map<String,Object>> health() {
  try {
   Integer tables=jdbc.queryForObject("SELECT count(*)::integer FROM information_schema.tables WHERE table_schema='campus' AND table_type='BASE TABLE'",Integer.class);
   if (tables == null || tables != 15) return ResponseEntity.status(503).body(Map.of("status","NOT_READY","database","CONNECTED","schema","MISSING_OR_INCOMPLETE"));
   jdbc.queryForObject("SELECT count(*) FROM campus.events",Long.class);
   return ResponseEntity.ok(Map.of("status","UP","database","CONNECTED","schema","campus","tables",tables));
  } catch (Exception exception) {
   return ResponseEntity.status(503).body(Map.of("status","DOWN","database","UNAVAILABLE"));
  }
 }
}
