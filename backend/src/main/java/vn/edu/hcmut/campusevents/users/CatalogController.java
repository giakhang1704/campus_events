package vn.edu.hcmut.campusevents.users;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
import vn.edu.hcmut.campusevents.catalog.CatalogService;
import vn.edu.hcmut.campusevents.catalog.Department;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {
    private final CatalogService catalogs;

    public CatalogController(CatalogService catalogs) {
        this.catalogs = catalogs;
    }

    @GetMapping("/departments")
    public List<Department> departments() {
        return catalogs.departments();
    }

    @GetMapping("/organization-units")
    public List<Map<String, Object>> organizationUnits() {
        return catalogs.organizationUnits();
    }
}
