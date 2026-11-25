package vn.edu.hcmut.campusevents.security;

import org.junit.jupiter.api.Test;
import vn.edu.hcmut.campusevents.exception.RateLimitException;
import java.time.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class AuthRateLimiterTest {
    private final Clock clock = org.mockito.Mockito.mock(Clock.class);
    private AuthRateLimiter limiter(int capacity) {
        org.mockito.Mockito.when(clock.millis()).thenReturn(1000L);
        return new AuthRateLimiter(true, 100, 3, 2, 60, capacity, clock);
    }

    @Test void normalizedAccountLimitSurvivesChangingIpAndExpires() {
        var limiter = limiter(100);
        for (int i = 0; i < 3; i++) limiter.login("ip" + i, "USER@example.test ");
        assertEquals(60, assertThrows(RateLimitException.class,
                () -> limiter.login("other", "user@EXAMPLE.test")).retryAfterSeconds);
        org.mockito.Mockito.when(clock.millis()).thenReturn(61000L);
        assertDoesNotThrow(() -> limiter.login("other", "user@example.test"));
    }

    @Test void successfulLoginResetsAccountButNotIpLimit() {
        var limiter = new AuthRateLimiter(true, 2, 1, 2, 60, 100, Clock.systemUTC());
        limiter.login("same-ip", "user@example.test");
        limiter.loginSucceeded("user@example.test");
        limiter.login("same-ip", "user@example.test");
        limiter.loginSucceeded("user@example.test");
        assertThrows(RateLimitException.class, () -> limiter.login("same-ip", "other@example.test"));
    }

    @Test void registrationHasIndependentLimitAndCapacityCannotEvictActiveBuckets() {
        var limiter = limiter(3);
        limiter.login("ip", "user@example.test");
        limiter.registration("ip");
        limiter.registration("ip");
        assertThrows(RateLimitException.class, () -> limiter.registration("ip"));
        assertThrows(RateLimitException.class, () -> limiter.login("new-ip", "new@example.test"));
        assertDoesNotThrow(() -> limiter.login("ip", "user@example.test"));
    }

    @Test void concurrentRequestsCannotExceedAccountLimit() throws Exception {
        var limiter = limiter(100);
        var accepted = new AtomicInteger();
        try (var workers = Executors.newFixedThreadPool(8)) {
            var tasks = new java.util.ArrayList<Future<?>>();
            for (int i = 0; i < 30; i++) tasks.add(workers.submit(() -> {
                try { limiter.login("ip", "user@example.test"); accepted.incrementAndGet(); }
                catch (RateLimitException expected) { }
            }));
            for (var task : tasks) task.get();
        }
        assertEquals(3, accepted.get());
    }

    @Test void disabledFixtureModeDoesNotThrottle() {
        var limiter = new AuthRateLimiter(false, 1, 1, 1, 60, 2, clock);
        for (int i = 0; i < 20; i++) { limiter.login("ip", "a@test"); limiter.registration("ip"); }
    }
}
