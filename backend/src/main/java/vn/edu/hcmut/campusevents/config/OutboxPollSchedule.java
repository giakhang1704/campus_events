package vn.edu.hcmut.campusevents.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import java.time.Clock;

@Component
public class OutboxPollSchedule {
    private final Clock clock;
    private final long base, maximum;
    private long next, delay, activeUntil, generation;

    @Autowired
    public OutboxPollSchedule(@Value("${campus.mail.poll-ms:5000}") long base,
            @Value("${campus.mail.idle-max-ms:600000}") long maximum) {
        this(base, maximum, Clock.systemUTC());
    }

    OutboxPollSchedule(long base, long maximum, Clock clock) {
        if (base < 100 || maximum < base) throw new IllegalArgumentException("Invalid mail polling intervals");
        this.base = base;
        this.maximum = maximum;
        this.delay = base;
        this.clock = clock;
    }

    @TransactionalEventListener
    public synchronized void queued(OutboxQueued event) {
        generation++;
        next = 0;
        delay = base;
        activeUntil = clock.millis() + 600_000;
    }

    public synchronized long begin() {
        return clock.millis() >= next ? generation : -1;
    }

    public synchronized void complete(long observedGeneration, boolean worked) {
        if (observedGeneration != generation) return; // A commit while polling must not lose its wake-up.
        long now = clock.millis();
        if (worked) activeUntil = now + 600_000;
        next = now + (now < activeUntil ? base : delay);
        delay = now < activeUntil ? base : Math.min(maximum, delay * 2);
    }
}
