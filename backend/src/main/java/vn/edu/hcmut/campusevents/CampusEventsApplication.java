package vn.edu.hcmut.campusevents;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

@SpringBootApplication
public class CampusEventsApplication {
    public static void main(String[] args) {
        // Canonical Vietnam timezone; avoid the legacy Asia/Saigon alias rejected by this
        // PostgreSQL image.
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
        SpringApplication.run(CampusEventsApplication.class, args);
    }
}
