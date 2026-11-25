package vn.edu.hcmut.campusevents.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.hcmut.campusevents.config.DepartmentCatalog;
import vn.edu.hcmut.campusevents.model.Department;
import vn.edu.hcmut.campusevents.model.OrganizationUnit;
import vn.edu.hcmut.campusevents.repository.ICatalogRepository;
import vn.edu.hcmut.campusevents.service.ICatalogService;

import java.util.Comparator;
import java.util.List;

@Service
public class CatalogServiceImpl implements ICatalogService {
    private final ICatalogRepository catalogs;

    public CatalogServiceImpl(ICatalogRepository catalogs) {
        this.catalogs = catalogs;
    }

    @Transactional
    public void synchronizeDepartments() {
        catalogs.synchronizeDepartments();
    }

    @Transactional(readOnly = true)
    public List<Department> departments() {
        return catalogs.findDepartments().stream()
                .sorted(
                        Comparator.comparingInt(
                                department -> DepartmentCatalog.codes().indexOf(department.code())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OrganizationUnit> organizationUnits() {
        return catalogs.findOrganizationUnits();
    }
}
