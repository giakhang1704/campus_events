package vn.edu.hcmut.campusevents.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import vn.edu.hcmut.campusevents.model.SeedOptions;
import vn.edu.hcmut.campusevents.service.ISeedService;

/** Opt-in only. Delegates transaction and business decisions to the service. */
@Component
@Order(10)
public class SeedRunner implements ApplicationRunner {
    private final Environment environment;
    private final ISeedService seed;

    public SeedRunner(Environment environment, ISeedService seed) {
        this.environment = environment;
        this.seed = seed;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        seed.initialize(
                new SeedOptions(
                        environment.getProperty("campus.bootstrap.enabled", Boolean.class, false),
                        environment.getProperty("campus.bootstrap.email"),
                        environment.getProperty("campus.bootstrap.password"),
                        environment.getProperty("campus.dev-seed.enabled", Boolean.class, false),
                        environment.getProperty("campus.dev-seed.password")));
    }
}
