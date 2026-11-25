package vn.edu.hcmut.campusevents.service;

import vn.edu.hcmut.campusevents.model.Department;
import vn.edu.hcmut.campusevents.model.OrganizationUnit;

import java.util.List;

public interface ICatalogService {
    void synchronizeDepartments();

    List<Department> departments();

    List<OrganizationUnit> organizationUnits();
}
