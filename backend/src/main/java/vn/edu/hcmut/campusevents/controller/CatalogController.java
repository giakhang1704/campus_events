package vn.edu.hcmut.campusevents.controller;

import org.springframework.web.bind.annotation.*;

import vn.edu.hcmut.campusevents.dto.catalog.DepartmentResponse;
import vn.edu.hcmut.campusevents.dto.catalog.OrganizationUnitResponse;
import vn.edu.hcmut.campusevents.service.ICatalogService;

import java.util.List;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {
    private final ICatalogService catalogs;

    public CatalogController(ICatalogService catalogs) {
        this.catalogs = catalogs;
    }

    @GetMapping("/departments")
    public List<DepartmentResponse> departments() {
        return catalogs.departments().stream()
                .map(row -> new DepartmentResponse(row.id(), row.code(), row.name()))
                .toList();
    }

    @GetMapping("/organization-units")
    public List<OrganizationUnitResponse> organizationUnits() {
        return catalogs.organizationUnits().stream()
                .map(row -> new OrganizationUnitResponse(row.id(), row.name()))
                .toList();
    }
}
