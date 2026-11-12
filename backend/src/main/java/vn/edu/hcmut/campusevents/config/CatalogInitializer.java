package vn.edu.hcmut.campusevents.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import vn.edu.hcmut.campusevents.service.ICatalogService;

/** Reference data is required even when development accounts/events are not seeded. */
@Component
@Order(0)
public class CatalogInitializer implements ApplicationRunner {
    private final ICatalogService catalogs;

    public CatalogInitializer(ICatalogService catalogs) {
        this.catalogs = catalogs;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        catalogs.synchronizeDepartments();
    }
}
