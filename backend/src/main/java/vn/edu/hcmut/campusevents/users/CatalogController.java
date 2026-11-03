package vn.edu.hcmut.campusevents.users;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/catalog")
public class CatalogController {
 private final JdbcTemplate db;public CatalogController(JdbcTemplate db){this.db=db;}
 @GetMapping("/departments") List<Map<String,Object>> departments(){return db.queryForList("SELECT id,code,name FROM campus.departments ORDER BY id");}
 @GetMapping("/organization-units") List<Map<String,Object>> units(){return db.queryForList("SELECT id,name FROM campus.organization_units ORDER BY id");}
}
