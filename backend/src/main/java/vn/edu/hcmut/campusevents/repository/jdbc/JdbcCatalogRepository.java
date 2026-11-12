package vn.edu.hcmut.campusevents.repository.jdbc;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import vn.edu.hcmut.campusevents.config.DepartmentCatalog;
import vn.edu.hcmut.campusevents.model.Department;
import vn.edu.hcmut.campusevents.model.OrganizationUnit;
import vn.edu.hcmut.campusevents.repository.ICatalogRepository;

import java.util.List;
import java.util.Map;

@Repository
public class JdbcCatalogRepository implements ICatalogRepository {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;

    public JdbcCatalogRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.named = new NamedParameterJdbcTemplate(jdbc);
    }

    public void synchronizeDepartments() {
        // Keep existing IDs and historical references; do not delete legacy rows.
        jdbc.batchUpdate(
                """
                INSERT INTO campus.departments(code,name) VALUES(?,?)
                ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name
                WHERE departments.name IS DISTINCT FROM EXCLUDED.name
                """,
                DepartmentCatalog.ENTRIES.stream()
                        .map(department -> new Object[] {department.code(), department.name()})
                        .toList());
    }

    public List<Department> findDepartments() {
        return named.query(
                "SELECT id,code,name FROM campus.departments WHERE code IN (:codes)",
                Map.of("codes", DepartmentCatalog.codes()),
                (rs, row) ->
                        new Department(
                                rs.getLong("id"), rs.getString("code"), rs.getString("name")));
    }

    public List<OrganizationUnit> findOrganizationUnits() {
        return jdbc.query(
                "SELECT id,name FROM campus.organization_units ORDER BY id",
                (rs, row) -> new OrganizationUnit(rs.getLong("id"), rs.getString("name")));
    }

    @Override
    public boolean organizationUnitExists(long id) {
        return jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM campus.organization_units WHERE id=?)",
                Boolean.class,
                id);
    }

    @Override
    public boolean selectableDepartmentExists(long id) {
        return named.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM campus.departments WHERE id=:id AND code IN (:codes))",
                Map.of("id", id, "codes", DepartmentCatalog.codes()),
                Boolean.class);
    }

    @Override
    public boolean departmentsExist(List<Long> ids) {
        if (ids.isEmpty()) return true;
        return named.queryForObject(
                        "SELECT count(*) FROM campus.departments WHERE id IN (:ids) AND code IN"
                                + " (:codes)",
                        Map.of("ids", ids, "codes", DepartmentCatalog.codes()),
                        Integer.class)
                == ids.size();
    }
}
