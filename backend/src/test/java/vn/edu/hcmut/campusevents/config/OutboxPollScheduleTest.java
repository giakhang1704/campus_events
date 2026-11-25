package vn.edu.hcmut.campusevents.config;

import org.junit.jupiter.api.Test;
import java.time.Clock;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OutboxPollScheduleTest {
    @Test void emptyPollingBacksOffButCommittedWorkWakesItWithoutLosingConcurrentSignals() {
        Clock clock = mock(Clock.class);
        when(clock.millis()).thenReturn(1_000L);
        var schedule = new OutboxPollSchedule(5000, 600000, clock);
        long generation = schedule.begin();
        schedule.complete(generation, false);
        assertEquals(-1, schedule.begin());
        when(clock.millis()).thenReturn(6000L);
        schedule.complete(schedule.begin(), false);
        when(clock.millis()).thenReturn(11000L);
        assertEquals(-1, schedule.begin()); // second idle delay is 10s, not 5s
        schedule.queued(new OutboxQueued());
        assertTrue(schedule.begin() >= 0);
        schedule.complete(generation, false); // stale completion cannot overwrite the signal
        assertTrue(schedule.begin() >= 0);
        schedule.complete(schedule.begin(), true);
        when(clock.millis()).thenReturn(16000L);
        assertTrue(schedule.begin() >= 0); // active retry cadence remains 5s
    }
}
