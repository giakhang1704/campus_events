package vn.edu.hcmut.campusevents.repository;

import vn.edu.hcmut.campusevents.model.Department;
import vn.edu.hcmut.campusevents.model.OrganizationUnit;

import java.util.List;

public interface ICatalogRepository {
    void synchronizeDepartments();

    List<Department> findDepartments();

    List<OrganizationUnit> findOrganizationUnits();

    boolean organizationUnitExists(long id);

    boolean selectableDepartmentExists(long id);

    boolean departmentsExist(List<Long> ids);
}
