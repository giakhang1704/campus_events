package vn.edu.hcmut.campusevents.catalog;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogRepository {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;

    public CatalogRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.named = new NamedParameterJdbcTemplate(jdbc);
    }

    public void synchronizeDepartments() {
        // Keep existing IDs and historical references; do not delete legacy rows.
        jdbc.batchUpdate("""
                INSERT INTO campus.departments(code,name) VALUES(?,?)
                ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name
                WHERE departments.name IS DISTINCT FROM EXCLUDED.name
                """, DepartmentCatalog.ENTRIES.stream()
                        .map(department -> new Object[]{department.code(), department.name()}).toList());
    }

    public List<Department> findDepartments() {
        return named.query("SELECT id,code,name FROM campus.departments WHERE code IN (:codes)",
                Map.of("codes", DepartmentCatalog.codes()),
                (rs, row) -> new Department(rs.getLong("id"), rs.getString("code"), rs.getString("name")));
    }

    public List<Map<String, Object>> findOrganizationUnits() {
        return jdbc.queryForList("SELECT id,name FROM campus.organization_units ORDER BY id");
    }
}
