package vn.edu.hcmut.campusevents.catalog;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogService {
    private final CatalogRepository catalogs;

    public CatalogService(CatalogRepository catalogs) {
        this.catalogs = catalogs;
    }

    @Transactional
    public void synchronizeDepartments() {
        catalogs.synchronizeDepartments();
    }

    @Transactional(readOnly = true)
    public List<Department> departments() {
        return catalogs.findDepartments().stream()
                .sorted(Comparator.comparingInt(department -> DepartmentCatalog.codes().indexOf(department.code())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> organizationUnits() {
        return catalogs.findOrganizationUnits();
    }
}
