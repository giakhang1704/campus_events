package vn.edu.hcmut.campusevents.service;

import vn.edu.hcmut.campusevents.model.Event;

public interface IWaitlistService {
    /** Caller holds the event row lock; the snapshot includes any just-updated capacity. */
    int promote(Event event);
}
