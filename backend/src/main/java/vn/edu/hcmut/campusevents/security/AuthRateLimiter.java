package vn.edu.hcmut.campusevents.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import vn.edu.hcmut.campusevents.exception.RateLimitException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/** Per-process limits. Account keys also protect deployments behind a shared proxy address. */
@Component
public class AuthRateLimiter {
    private record Bucket(long expires, int count) {}
    private final Map<String, Bucket> buckets = new LinkedHashMap<>();
    private final boolean enabled;
    private final int loginIp, loginAccount, registerIp, capacity;
    private final long windowMillis;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public AuthRateLimiter(
            @Value("${campus.auth.rate-limit.enabled:true}") boolean enabled,
            @Value("${campus.auth.rate-limit.login-ip:300}") int loginIp,
            @Value("${campus.auth.rate-limit.login-account:10}") int loginAccount,
            @Value("${campus.auth.rate-limit.register-ip:30}") int registerIp,
            @Value("${campus.auth.rate-limit.window-seconds:300}") int seconds,
            @Value("${campus.auth.rate-limit.capacity:20000}") int capacity) {
        this(enabled, loginIp, loginAccount, registerIp, seconds, capacity, Clock.systemUTC());
    }

    AuthRateLimiter(boolean enabled, int loginIp, int loginAccount, int registerIp,
                    int seconds, int capacity, Clock clock) {
        if (loginIp < 1 || loginAccount < 1 || registerIp < 1 || seconds < 1 || capacity < 2)
            throw new IllegalArgumentException("Invalid authentication rate limits");
        this.enabled = enabled;
        this.loginIp = loginIp;
        this.loginAccount = loginAccount;
        this.registerIp = registerIp;
        this.windowMillis = seconds * 1000L;
        this.capacity = capacity;
        this.clock = clock;
    }

    public synchronized void login(String remoteAddress, String email) {
        if (!enabled) return;
        take(new String[] {"login-ip:" + remoteAddress, accountKey(email)},
                new int[] {loginIp, loginAccount});
    }

    public synchronized void registration(String remoteAddress) {
        if (enabled) take(new String[] {"register-ip:" + remoteAddress}, new int[] {registerIp});
    }

    public synchronized void loginSucceeded(String email) {
        buckets.remove(accountKey(email));
    }

    private void take(String[] keys, int[] limits) {
        long now = clock.millis();
        buckets.entrySet().removeIf(entry -> entry.getValue().expires <= now);
        int missing = 0;
        for (int i = 0; i < keys.length; i++) {
            Bucket b = buckets.get(keys[i]);
            if (b == null) missing++;
            else if (b.count >= limits[i]) throw new RateLimitException((b.expires - now + 999) / 1000);
        }
        // Never evict an active limit: random identities must not let an attacker reset it.
        if (buckets.size() + missing > capacity) throw new RateLimitException(windowMillis / 1000);
        for (String key : keys) {
            Bucket b = buckets.get(key);
            buckets.put(key, b == null ? new Bucket(now + windowMillis, 1) : new Bucket(b.expires, b.count + 1));
        }
    }

    private static String accountKey(String email) {
        try {
            byte[] normalized = email.strip().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
            return "account:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(normalized));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
